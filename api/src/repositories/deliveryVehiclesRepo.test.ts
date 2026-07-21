import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliveryVehiclesRepository } from './deliveryVehiclesRepo';
import { NotFoundError, DatabaseError } from '../utils/errors';

vi.mock('../db/sqlite', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/sqlite';

describe('DeliveryVehiclesRepository', () => {
  let repository: DeliveryVehiclesRepository;
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

    repository = new DeliveryVehiclesRepository(mockDb);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all delivery vehicles', async () => {
      mockDb.all.mockResolvedValue([
        {
          delivery_vehicle_id: 1,
          branch_id: 1,
          license_plate: 'OCTO-1001',
          model: 'Sprinter Van',
          capacity_kg: 1200,
          status: 'active',
        },
      ]);

      const result = await repository.findAll();

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM delivery_vehicles ORDER BY delivery_vehicle_id',
      );
      expect(result).toHaveLength(1);
      expect(result[0].deliveryVehicleId).toBe(1);
    });

    it('should return empty array when no delivery vehicles exist', async () => {
      mockDb.all.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should propagate DatabaseError when db.all throws', async () => {
      mockDb.all.mockRejectedValue(new Error('connection lost'));

      await expect(repository.findAll()).rejects.toThrow(DatabaseError);
    });
  });

  describe('findById', () => {
    it('should return delivery vehicle when found', async () => {
      mockDb.get.mockResolvedValue({
        delivery_vehicle_id: 1,
        branch_id: 1,
        license_plate: 'OCTO-1001',
        model: 'Sprinter Van',
        capacity_kg: 1200,
        status: 'active',
      });

      const result = await repository.findById(1);

      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT * FROM delivery_vehicles WHERE delivery_vehicle_id = ?',
        [1],
      );
      expect(result?.deliveryVehicleId).toBe(1);
      expect(result?.licensePlate).toBe('OCTO-1001');
    });

    it('should return null when delivery vehicle not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it('should propagate DatabaseError when db.get throws', async () => {
      mockDb.get.mockRejectedValue(new Error('read failed'));

      await expect(repository.findById(1)).rejects.toThrow(DatabaseError);
    });
  });

  describe('create', () => {
    it('should create and return a delivery vehicle', async () => {
      const newVehicle = {
        branchId: 1,
        licensePlate: 'OCTO-3001',
        model: 'Mini Van',
        capacityKg: 900,
        status: 'active',
      };

      mockDb.run.mockResolvedValue({ lastID: 7, changes: 1 });
      mockDb.get.mockResolvedValue({
        delivery_vehicle_id: 7,
        branch_id: 1,
        license_plate: 'OCTO-3001',
        model: 'Mini Van',
        capacity_kg: 900,
        status: 'active',
      });

      const result = await repository.create(newVehicle);

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO delivery_vehicles (branch_id, license_plate, model, capacity_kg, status) VALUES (?, ?, ?, ?, ?)',
        [1, 'OCTO-3001', 'Mini Van', 900, 'active'],
      );
      expect(result.deliveryVehicleId).toBe(7);
    });

    it('should throw when created row cannot be retrieved', async () => {
      mockDb.run.mockResolvedValue({ lastID: 8, changes: 1 });
      mockDb.get.mockResolvedValue(undefined);

      await expect(
        repository.create({
          branchId: 1,
          licensePlate: 'OCTO-3002',
          model: 'Mini Van',
          capacityKg: 900,
          status: 'active',
        }),
      ).rejects.toThrow('Failed to retrieve created delivery vehicle');
    });

    it('should propagate DatabaseError when db.run throws', async () => {
      mockDb.run.mockRejectedValue(new Error('write failed'));

      await expect(
        repository.create({
          branchId: 1,
          licensePlate: 'OCTO-3003',
          model: 'Mini Van',
          capacityKg: 900,
          status: 'active',
        }),
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('update', () => {
    it('should update and return delivery vehicle', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({
        delivery_vehicle_id: 1,
        branch_id: 2,
        license_plate: 'OCTO-1001',
        model: 'Sprinter Van XL',
        capacity_kg: 1500,
        status: 'maintenance',
      });

      const result = await repository.update(1, {
        branchId: 2,
        model: 'Sprinter Van XL',
        capacityKg: 1500,
        status: 'maintenance',
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE delivery_vehicles SET branch_id = ?, model = ?, capacity_kg = ?, status = ? WHERE delivery_vehicle_id = ?',
        [2, 'Sprinter Van XL', 1500, 'maintenance', 1],
      );
      expect(result.branchId).toBe(2);
      expect(result.status).toBe('maintenance');
    });

    it('should throw NotFoundError when delivery vehicle does not exist', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });

      await expect(repository.update(999, { status: 'inactive' })).rejects.toThrow(NotFoundError);
    });

    it('should throw when updated row cannot be retrieved', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(undefined);

      await expect(repository.update(1, { status: 'inactive' })).rejects.toThrow(
        'Failed to retrieve updated delivery vehicle',
      );
    });

    it('should propagate DatabaseError when db.run throws', async () => {
      mockDb.run.mockRejectedValue(new Error('write failed'));

      await expect(repository.update(1, { status: 'active' })).rejects.toThrow(DatabaseError);
    });
  });

  describe('delete', () => {
    it('should delete existing delivery vehicle', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await repository.delete(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM delivery_vehicles WHERE delivery_vehicle_id = ?',
        [1],
      );
    });

    it('should throw NotFoundError when delivery vehicle does not exist', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });

      await expect(repository.delete(999)).rejects.toThrow(NotFoundError);
    });

    it('should propagate DatabaseError when db.run throws', async () => {
      mockDb.run.mockRejectedValue(new Error('delete failed'));

      await expect(repository.delete(1)).rejects.toThrow(DatabaseError);
    });
  });

  describe('exists', () => {
    it('should return true when delivery vehicle exists', async () => {
      mockDb.get.mockResolvedValue({ count: 1 });

      const result = await repository.exists(1);

      expect(result).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM delivery_vehicles WHERE delivery_vehicle_id = ?',
        [1],
      );
    });

    it('should return false when delivery vehicle does not exist', async () => {
      mockDb.get.mockResolvedValue({ count: 0 });

      const result = await repository.exists(999);

      expect(result).toBe(false);
    });

    it('should propagate DatabaseError when db.get throws', async () => {
      mockDb.get.mockRejectedValue(new Error('read failed'));

      await expect(repository.exists(1)).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByBranchId', () => {
    it('should return delivery vehicles for a branch', async () => {
      mockDb.all.mockResolvedValue([
        {
          delivery_vehicle_id: 1,
          branch_id: 2,
          license_plate: 'OCTO-2001',
          model: 'Cargo Van',
          capacity_kg: 1800,
          status: 'active',
        },
      ]);

      const result = await repository.findByBranchId(2);

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM delivery_vehicles WHERE branch_id = ? ORDER BY license_plate',
        [2],
      );
      expect(result).toHaveLength(1);
      expect(result[0].branchId).toBe(2);
    });

    it('should return empty array when no vehicles are found for a branch', async () => {
      mockDb.all.mockResolvedValue([]);

      const result = await repository.findByBranchId(99);

      expect(result).toEqual([]);
    });

    it('should propagate DatabaseError when db.all throws', async () => {
      mockDb.all.mockRejectedValue(new Error('query failed'));

      await expect(repository.findByBranchId(1)).rejects.toThrow(DatabaseError);
    });
  });
});
