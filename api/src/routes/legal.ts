/**
 * @swagger
 * tags:
 *   name: Legal
 *   description: API endpoints for legal document management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LegalDocument:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the document
 *         version:
 *           type: string
 *           description: Document version number
 *         filename:
 *           type: string
 *           description: PDF filename
 *         language:
 *           type: string
 *           description: Language code (e.g. en, de)
 *         effectiveDate:
 *           type: string
 *           format: date
 *           description: Date the document became effective
 */

/**
 * @swagger
 * /api/legal/terms:
 *   get:
 *     summary: List available terms and conditions documents
 *     tags: [Legal]
 *     responses:
 *       200:
 *         description: List of available legal documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LegalDocument'
 *
 * /api/legal/terms/download:
 *   get:
 *     summary: Download a terms and conditions PDF
 *     tags: [Legal]
 *     parameters:
 *       - in: query
 *         name: file
 *         required: true
 *         schema:
 *           type: string
 *         description: PDF filename to download
 *       - in: query
 *         name: lang
 *         required: false
 *         schema:
 *           type: string
 *           default: en
 *         description: Language code (en or de)
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing or invalid request parameters
 *       403:
 *         description: Access denied (automated request detected)
 *       404:
 *         description: Document not found
 *       429:
 *         description: Too many requests
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { UAParser } from 'ua-parser-js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const ALLOWED_LANGS = new Set(['en', 'de']);
const LEGAL_DOCS_BASE_DIR = path.resolve(__dirname, '../../documents/legal');

const legalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// List of known bot user agents and SEO crawlers
const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /applebot/i,
  /crawler/i,
  /spider/i,
  /bot/i,
  /scraper/i,
  /chatgpt/i,
  /gpt/i,
  /claude/i,
  /anthropic/i,
  /openai/i
];

// Function to detect if request is from a bot
const isBotRequest = (userAgent: string) => {
  if (!userAgent) return true; // No user agent = suspicious
  
  // Check against known bot patterns
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  
  // Parse user agent for additional bot detection
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  // Check if it's a known bot browser
  if (result.browser.name && /bot|crawler|spider/i.test(result.browser.name)) {
    return true;
  }
  
  // Check for suspicious OS (many bots don't report proper OS)
  if (!result.os.name || result.os.name === 'undefined') {
    return true;
  }
  
  return false;
};

// Terms download endpoint
router.get('/terms/download', legalRateLimit, (req, res) => {
  try {
    const userAgent = req.get('User-Agent') || '';
    
    // Bot detection - block SEO crawlers and AI bots
    if (isBotRequest(userAgent)) {
      console.log(`🤖 Bot detected and blocked: ${userAgent}`);
      res.status(403).json({ 
        error: 'Access denied',
        message: 'Automated access to PDF downloads is not permitted',
        reason: 'Bot/crawler detected'
      });
      return;
    }
    
    console.log(`✅ Human user allowed: ${userAgent}`);
    
    const { file, lang = 'en' } = req.query;
    if (!file || typeof file !== 'string') {
      res.status(400).json({ error: 'File parameter is required' });
      return;
    }

    // Validate language against allow-list
    if (typeof lang !== 'string' || !ALLOWED_LANGS.has(lang)) {
      res.status(400).json({ error: 'Invalid language parameter' });
      return;
    }

    // Restrict to PDF files only (safe characters, .pdf extension)
    if (!/^[\w\-. ]+\.pdf$/i.test(file)) {
      res.status(400).json({ error: 'Invalid file parameter' });
      return;
    }

    // Resolve path and enforce it stays within the base directory
    const documentPath = path.resolve(LEGAL_DOCS_BASE_DIR, lang, file);
    if (!documentPath.startsWith(LEGAL_DOCS_BASE_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid file parameter' });
      return;
    }

    if (!fs.existsSync(documentPath)) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const safeFilename = path.basename(documentPath);
    res.download(documentPath, safeFilename);
  } catch (error) {
    console.error('Error in terms download:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List available terms documents (generated from filesystem)
router.get('/terms', legalRateLimit, (_req, res) => {
  const documents: Array<{
    id: number;
    version: string;
    filename: string;
    language: string;
    effectiveDate: string;
  }> = [];
  let id = 1;

  for (const lang of ALLOWED_LANGS) {
    const langDir = path.join(LEGAL_DOCS_BASE_DIR, lang);
    if (!fs.existsSync(langDir)) continue;
    const files = fs.readdirSync(langDir).filter(f => /\.pdf$/i.test(f));
    for (const filename of files) {
      const versionMatch = filename.match(/v([\d.]+)/i);
      const version = versionMatch ? versionMatch[1] : '1.0';
      documents.push({
        id: id++,
        version,
        filename,
        language: lang,
        effectiveDate: '2024-01-01',
      });
    }
  }

  res.json(documents);
});

export default router;
