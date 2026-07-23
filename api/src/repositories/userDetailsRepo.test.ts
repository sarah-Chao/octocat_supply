import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDetailsRepository } from './userDetailsRepo';
import { DatabaseError } from '../utils/errors';

vi.mock('../db/sqlite', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/sqlite';

describe('UserDetailsRepository', () => {
  let repository: UserDetailsRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      db: {} as any,
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      close: vi.fn(),
    };

    (getDatabase as any).mockResolvedValue(mockDb);

    repository = new UserDetailsRepository(mockDb);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return a user detail', async () => {
      mockDb.run.mockResolvedValue({ lastID: 7, changes: 1 });
      mockDb.get.mockResolvedValue({
        user_id: 7,
        username: 'octocat',
        email: 'octo@example.com',
        first_name: 'Octo',
        last_name: 'Cat',
        phone: '555-0100',
        address: '123 Ocean Ave',
        role: 'admin',
      });

      const result = await repository.create({
        username: 'octocat',
        email: 'octo@example.com',
        firstName: 'Octo',
        lastName: 'Cat',
        phone: '555-0100',
        address: '123 Ocean Ave',
        role: 'admin',
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO user_details (username, email, first_name, last_name, phone, address, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['octocat', 'octo@example.com', 'Octo', 'Cat', '555-0100', '123 Ocean Ave', 'admin'],
      );
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM user_details WHERE user_id = ?', [7]);
      expect(result.userId).toBe(7);
    });

    it('should throw when the created user detail ID is missing', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await expect(
        repository.create({
          username: 'octocat',
          email: 'octo@example.com',
          firstName: 'Octo',
          lastName: 'Cat',
          phone: '555-0100',
          address: '123 Ocean Ave',
          role: 'admin',
        }),
      ).rejects.toThrow(new DatabaseError('Database operation failed: Failed to determine created user detail ID'));

      expect(mockDb.get).not.toHaveBeenCalled();
    });
  });
});
