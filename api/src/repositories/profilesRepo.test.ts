import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfilesRepository } from './profilesRepo';
import { NotFoundError } from '../utils/errors';

// Mock the getDatabase function first
vi.mock('../db/sqlite', () => ({
  getDatabase: vi.fn(),
}));

// Import the mocked module
import { getDatabase } from '../db/sqlite';

describe('ProfilesRepository', () => {
  let repository: ProfilesRepository;
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

    repository = new ProfilesRepository(mockDb);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all profiles mapped to camelCase', async () => {
      const mockRows = [
        {
          profile_id: 1,
          username: 'felix.admin',
          email: 'felix@octocat.com',
          full_name: 'Felix Whiskerton',
          role: 'admin',
          department: 'Operations',
          phone: '555-1001',
          is_active: 1,
          created_at: '2024-01-15T10:00:00.000Z',
        },
        {
          profile_id: 2,
          username: 'tabitha.manager',
          email: 'tabitha@octocat.com',
          full_name: 'Tabitha Pawson',
          role: 'manager',
          department: 'Supply Chain',
          phone: '555-1002',
          is_active: 1,
          created_at: '2024-01-16T11:30:00.000Z',
        },
      ];
      mockDb.all.mockResolvedValue(mockRows);

      const result = await repository.findAll();

      expect(mockDb.all).toHaveBeenCalledWith('SELECT * FROM profiles ORDER BY profile_id');
      expect(result).toHaveLength(2);
      expect(result[0].profileId).toBe(1);
      expect(result[0].username).toBe('felix.admin');
      expect(result[0].isActive).toBe(true);
    });

    it('should return empty array when no profiles exist', async () => {
      mockDb.all.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDb.all.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findAll()).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return profile when found', async () => {
      const mockRow = {
        profile_id: 1,
        username: 'felix.admin',
        email: 'felix@octocat.com',
        full_name: 'Felix Whiskerton',
        role: 'admin',
        department: 'Operations',
        phone: '555-1001',
        is_active: 1,
        created_at: '2024-01-15T10:00:00.000Z',
      };
      mockDb.get.mockResolvedValue(mockRow);

      const result = await repository.findById(1);

      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM profiles WHERE profile_id = ?', [1]);
      expect(result?.profileId).toBe(1);
      expect(result?.username).toBe('felix.admin');
      expect(result?.isActive).toBe(true);
    });

    it('should return null when profile not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it('should convert is_active integer to boolean', async () => {
      mockDb.get.mockResolvedValue({
        profile_id: 4,
        username: 'oscar.inactive',
        email: 'oscar@octocat.com',
        full_name: 'Oscar Claws',
        role: 'viewer',
        department: 'Logistics',
        phone: '555-1004',
        is_active: 0,
        created_at: '2024-01-18T14:45:00.000Z',
      });

      const result = await repository.findById(4);

      expect(result?.isActive).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a new profile and return it', async () => {
      const newProfile = {
        username: 'new.user',
        email: 'new@octocat.com',
        fullName: 'New User',
        role: 'viewer',
        department: 'IT',
        phone: '555-9999',
        isActive: true,
        createdAt: '2024-06-01T00:00:00.000Z',
      };

      mockDb.run.mockResolvedValue({ lastID: 5, changes: 1 });
      mockDb.get.mockResolvedValue({
        profile_id: 5,
        username: 'new.user',
        email: 'new@octocat.com',
        full_name: 'New User',
        role: 'viewer',
        department: 'IT',
        phone: '555-9999',
        is_active: 1,
        created_at: '2024-06-01T00:00:00.000Z',
      });

      const result = await repository.create(newProfile);

      expect(mockDb.run).toHaveBeenCalled();
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM profiles WHERE profile_id = ?', [5]);
      expect(result.profileId).toBe(5);
      expect(result.username).toBe('new.user');
    });

    it('should throw error if created profile cannot be retrieved', async () => {
      mockDb.run.mockResolvedValue({ lastID: 5, changes: 1 });
      mockDb.get.mockResolvedValue(null);

      await expect(
        repository.create({
          username: 'new.user',
          email: 'new@octocat.com',
          fullName: 'New User',
          role: 'viewer',
          department: 'IT',
          phone: '555-9999',
          isActive: true,
          createdAt: '2024-06-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('Failed to retrieve created profile');
    });
  });

  describe('update', () => {
    it('should update existing profile and return updated data', async () => {
      const updateData = { fullName: 'Updated Name', role: 'manager' };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({
        profile_id: 1,
        username: 'felix.admin',
        email: 'felix@octocat.com',
        full_name: 'Updated Name',
        role: 'manager',
        department: 'Operations',
        phone: '555-1001',
        is_active: 1,
        created_at: '2024-01-15T10:00:00.000Z',
      });

      const result = await repository.update(1, updateData);

      expect(mockDb.run).toHaveBeenCalled();
      expect(result.fullName).toBe('Updated Name');
      expect(result.role).toBe('manager');
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });

      await expect(repository.update(999, { fullName: 'Ghost' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete existing profile', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await repository.delete(1);

      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM profiles WHERE profile_id = ?', [1]);
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });

      await expect(repository.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('exists', () => {
    it('should return true when profile exists', async () => {
      mockDb.get.mockResolvedValue({ count: 1 });

      const result = await repository.exists(1);

      expect(result).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM profiles WHERE profile_id = ?',
        [1],
      );
    });

    it('should return false when profile does not exist', async () => {
      mockDb.get.mockResolvedValue({ count: 0 });

      const result = await repository.exists(999);

      expect(result).toBe(false);
    });

    it('should handle null result', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await repository.exists(999);

      expect(result).toBe(false);
    });
  });
});
