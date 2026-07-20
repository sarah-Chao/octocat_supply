/**
 * Repository for profiles data access
 */

import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Profile } from '../models/profile';
import { handleDatabaseError, NotFoundError } from '../utils/errors';
import { buildInsertSQL, buildUpdateSQL, objectToCamelCase, mapDatabaseRows, DatabaseRow } from '../utils/sql';

export class ProfilesRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Get all profiles
   */
  async findAll(): Promise<Profile[]> {
    try {
      const rows = await this.db.all<DatabaseRow>('SELECT * FROM profiles ORDER BY profile_id');
      return mapDatabaseRows<Profile>(rows).map(this.convertBooleanFields);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Get profile by ID
   */
  async findById(id: number): Promise<Profile | null> {
    try {
      const row = await this.db.get<DatabaseRow>('SELECT * FROM profiles WHERE profile_id = ?', [id]);
      return row ? this.convertBooleanFields(objectToCamelCase<Profile>(row)) : null;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Convert integer fields to boolean for SQLite compatibility
   */
  private convertBooleanFields(profile: Profile): Profile {
    return {
      ...profile,
      isActive: Boolean(profile.isActive),
    };
  }

  /**
   * Create a new profile
   */
  async create(profile: Omit<Profile, 'profileId'>): Promise<Profile> {
    try {
      const { sql, values } = buildInsertSQL('profiles', profile);
      const result = await this.db.run(sql, values);

      const createdProfile = await this.findById(result.lastID || 0);
      if (!createdProfile) {
        throw new Error('Failed to retrieve created profile');
      }

      return createdProfile;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Update profile by ID
   */
  async update(id: number, profile: Partial<Omit<Profile, 'profileId'>>): Promise<Profile> {
    try {
      const { sql, values } = buildUpdateSQL('profiles', profile, 'profile_id = ?');
      const result = await this.db.run(sql, [...values, id]);

      if (result.changes === 0) {
        throw new NotFoundError('Profile', id);
      }

      const updatedProfile = await this.findById(id);
      if (!updatedProfile) {
        throw new Error('Failed to retrieve updated profile');
      }

      return updatedProfile;
    } catch (error) {
      handleDatabaseError(error, 'Profile', id);
    }
  }

  /**
   * Delete profile by ID
   */
  async delete(id: number): Promise<void> {
    try {
      const result = await this.db.run('DELETE FROM profiles WHERE profile_id = ?', [id]);

      if (result.changes === 0) {
        throw new NotFoundError('Profile', id);
      }
    } catch (error) {
      handleDatabaseError(error, 'Profile', id);
    }
  }

  /**
   * Check if profile exists
   */
  async exists(id: number): Promise<boolean> {
    try {
      const result = await this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM profiles WHERE profile_id = ?',
        [id],
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      handleDatabaseError(error);
    }
  }
}

// Factory function to create repository instance
export async function createProfilesRepository(isTest: boolean = false): Promise<ProfilesRepository> {
  const db = await getDatabase(isTest);
  return new ProfilesRepository(db);
}

// Singleton instance for default usage
let profilesRepo: ProfilesRepository | null = null;

export async function getProfilesRepository(isTest: boolean = false): Promise<ProfilesRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return createProfilesRepository(true);
  }
  if (!profilesRepo) {
    profilesRepo = await createProfilesRepository(false);
  }
  return profilesRepo;
}
