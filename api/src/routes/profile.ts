/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: API endpoints for managing user profiles
 */

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Create a new user profile
 *     tags: [Profiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Profile'
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *
 * /api/profiles/{id}:
 *   get:
 *     summary: Get a user profile by ID
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Profile found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profile not found
 *   put:
 *     summary: Update a user profile
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Profile'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profile not found
 *   delete:
 *     summary: Delete a user profile
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     responses:
 *       204:
 *         description: Profile deleted successfully
 *       404:
 *         description: Profile not found
 */

import express from 'express';
import { Profile } from '../models/profile';
import { getProfilesRepository } from '../repositories/profilesRepo';
import { NotFoundError } from '../utils/errors';

const router = express.Router();

// Create a new profile
router.post('/', async (req, res, next) => {
  try {
    const repo = await getProfilesRepository();
    const newProfile = await repo.create(req.body as Omit<Profile, 'profileId'>);
    res.status(201).json(newProfile);
  } catch (error) {
    next(error);
  }
});

// Get a profile by ID
router.get('/:id', async (req, res, next) => {
  try {
    const repo = await getProfilesRepository();
    const profile = await repo.findById(parseInt(req.params.id));
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).send('Profile not found');
    }
  } catch (error) {
    next(error);
  }
});

// Update a profile by ID
router.put('/:id', async (req, res, next) => {
  try {
    const repo = await getProfilesRepository();
    const updatedProfile = await repo.update(parseInt(req.params.id), req.body);
    res.json(updatedProfile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).send('Profile not found');
    } else {
      next(error);
    }
  }
});

// Delete a profile by ID
router.delete('/:id', async (req, res, next) => {
  try {
    const repo = await getProfilesRepository();
    await repo.delete(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).send('Profile not found');
    } else {
      next(error);
    }
  }
});

export default router;
