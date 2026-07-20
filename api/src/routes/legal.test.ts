import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import legalRouter from './legal';

const HUMAN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BOT_UA = 'Googlebot/2.1 (+http://www.google.com/bot.html)';

let app: express.Express;

app = express();
app.use(express.json());
app.use('/legal', legalRouter);

describe('Legal API', () => {
  describe('GET /legal/terms', () => {
    it('should return list of available documents', async () => {
      const response = await request(app).get('/legal/terms');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should only list documents that actually exist on disk
      for (const doc of response.body) {
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('version');
        expect(doc).toHaveProperty('filename');
        expect(doc).toHaveProperty('language');
        expect(doc).toHaveProperty('effectiveDate');
        expect(['en', 'de']).toContain(doc.language);
        expect(doc.filename).toMatch(/\.pdf$/i);
      }
    });
  });

  describe('GET /legal/terms/download', () => {
    it('should return 403 for bot requests', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', BOT_UA)
        .query({ file: 'terms_v2.1.pdf', lang: 'en' });
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return 400 when file parameter is missing', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', HUMAN_UA)
        .query({ lang: 'en' });
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid language', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', HUMAN_UA)
        .query({ file: 'terms_v2.1.pdf', lang: 'fr' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid language parameter');
    });

    it('should return 400 for path traversal attempts', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', HUMAN_UA)
        .query({ file: '../super-secret.txt', lang: 'en' });
      expect(response.status).toBe(400);
    });

    it('should return 400 for non-PDF files', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', HUMAN_UA)
        .query({ file: 'terms.txt', lang: 'en' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid file parameter');
    });

    it('should return 404 for non-existent PDF', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', HUMAN_UA)
        .query({ file: 'nonexistent.pdf', lang: 'en' });
      expect(response.status).toBe(404);
    });

    it('should download an existing PDF for a human user', async () => {
      const response = await request(app)
        .get('/legal/terms/download')
        .set('User-Agent', HUMAN_UA)
        .query({ file: 'terms_v2.1.pdf', lang: 'en' });
      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toMatch(/terms_v2\.1\.pdf/);
    });
  });
});
