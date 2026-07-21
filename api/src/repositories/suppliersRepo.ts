/**
 * Repository for suppliers data access
 */

import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Supplier } from '../models/supplier';
import { handleDatabaseError, NotFoundError } from '../utils/errors';
import { buildInsertSQL, buildUpdateSQL, objectToCamelCase, mapDatabaseRows, DatabaseRow } from '../utils/sql';

/** Shape of the scalar count row returned by EXISTS-style COUNT queries. */
type CountRow = { count: number };

/**
 * Normalises SQLite integer-backed boolean columns to native JS booleans.
 *
 * SQLite stores booleans as `0`/`1` integers. This function converts the
 * `active` and `verified` fields so consumers always receive `true`/`false`.
 *
 * @param {Supplier} supplier - The raw supplier object returned from the DB.
 * @returns {Supplier} A new supplier object with `active` and `verified`
 *   coerced to `boolean`.
 */
function convertBooleanFields(supplier: Supplier): Supplier {
  return {
    ...supplier,
    active: Boolean(supplier.active),
    verified: Boolean(supplier.verified),
  };
}

export class SuppliersRepository {
  private db: DatabaseConnection;

  /**
   * Creates an instance of SuppliersRepository.
   *
   * @param {DatabaseConnection} db - The active database connection to use for all queries.
   *
   * @example
   * const db = await getDatabase();
   * const repo = new SuppliersRepository(db);
   */
  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Retrieves all suppliers from the database, ordered by `supplier_id` ascending.
   *
   * SQLite integer fields `active` and `verified` are normalised to booleans
   * before returning.
   *
   * @returns {Promise<Supplier[]>} Resolves with an array of all suppliers.
   *   Returns an empty array when no suppliers exist.
   * @throws {DatabaseError} Re-throws any unexpected database-level error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * const suppliers = await repo.findAll();
   * // [{ supplierId: 1, name: 'Acme Corp', active: true, ... }, ...]
   */
  async findAll(): Promise<Supplier[]> {
    try {
      const rows = await this.db.all<DatabaseRow>('SELECT * FROM suppliers ORDER BY supplier_id');
      return mapDatabaseRows<Supplier>(rows).map(convertBooleanFields);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Retrieves a single supplier by its primary key.
   *
   * @param {number} id - The `supplier_id` of the supplier to look up.
   * @returns {Promise<Supplier | null>} Resolves with the matching supplier,
   *   or `null` if no supplier with the given ID exists.
   * @throws {DatabaseError} Re-throws any unexpected database-level error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * const supplier = await repo.findById(42);
   * if (supplier) {
   *   console.log(supplier.name); // 'Acme Corp'
   * }
   */
  async findById(id: number): Promise<Supplier | null> {
    try {
      const row = await this.db.get<DatabaseRow>('SELECT * FROM suppliers WHERE supplier_id = ?', [id]);
      return row ? convertBooleanFields(objectToCamelCase<Supplier>(row)) : null;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Fetches a supplier by ID and throws if it cannot be found.
   *
   * Used after INSERT and UPDATE operations to return the persisted row.
   * Provides a single, named place for the post-write assertion.
   *
   * @param {number} id - The `supplier_id` to look up.
   * @param {'created' | 'updated'} context - Describes the operation, used in
   *   the error message when the row cannot be retrieved.
   * @returns {Promise<Supplier>} The retrieved supplier.
   * @throws {Error} If the row is unexpectedly absent after the write.
   */
  private async requireById(id: number, context: 'created' | 'updated'): Promise<Supplier> {
    const supplier = await this.findById(id);
    if (!supplier) {
      throw new Error(`Failed to retrieve ${context} supplier`);
    }
    return supplier;
  }

  /**
   * Inserts a new supplier record and returns the persisted entity.
   *
   * The `supplierId` is auto-assigned by the database; do not include it in
   * the input object.
   *
   * @param {Omit<Supplier, 'supplierId'>} supplier - The supplier data to
   *   insert. All fields except `supplierId` are required.
   * @returns {Promise<Supplier>} Resolves with the fully-populated supplier
   *   record, including the newly assigned `supplierId`.
   * @throws {ConflictError} If a unique constraint is violated (e.g. duplicate
   *   email).
   * @throws {ValidationError} If a foreign-key constraint is violated.
   * @throws {DatabaseError} Re-throws any other unexpected database error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * const created = await repo.create({
   *   name: 'Acme Corp',
   *   description: 'Industrial supplier',
   *   contactPerson: 'Alice',
   *   email: 'alice@acme.com',
   *   phone: '555-0100',
   *   active: true,
   *   verified: false,
   * });
   * console.log(created.supplierId); // e.g. 7
   */
  async create(supplier: Omit<Supplier, 'supplierId'>): Promise<Supplier> {
    try {
      const { sql, values } = buildInsertSQL('suppliers', supplier);
      const result = await this.db.run(sql, values);

      return this.requireById(result.lastID || 0, 'created');
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Updates one or more fields of an existing supplier.
   *
   * Only the fields present in `supplier` are written; all other columns are
   * left unchanged (partial update / PATCH semantics).
   *
   * @param {number} id - The `supplier_id` of the supplier to update.
   * @param {Partial<Omit<Supplier, 'supplierId'>>} supplier - An object
   *   containing only the fields that should be updated.
   * @returns {Promise<Supplier>} Resolves with the full, updated supplier
   *   record after the write.
   * @throws {NotFoundError} If no supplier with the given `id` exists
   *   (`supplier_id` not found → `changes === 0`).
   * @throws {ConflictError} If the update violates a unique constraint.
   * @throws {ValidationError} If the update violates a foreign-key constraint.
   * @throws {DatabaseError} Re-throws any other unexpected database error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * const updated = await repo.update(42, { active: false });
   * console.log(updated.active); // false
   */
  async update(id: number, supplier: Partial<Omit<Supplier, 'supplierId'>>): Promise<Supplier> {
    try {
      const { sql, values } = buildUpdateSQL('suppliers', supplier, 'supplier_id = ?');
      const result = await this.db.run(sql, [...values, id]);

      if (result.changes === 0) {
        throw new NotFoundError('Supplier', id);
      }

      return this.requireById(id, 'updated');
    } catch (error) {
      handleDatabaseError(error, 'Supplier', id);
    }
  }

  /**
   * Permanently removes a supplier from the database.
   *
   * @param {number} id - The `supplier_id` of the supplier to delete.
   * @returns {Promise<void>} Resolves when the supplier has been deleted.
   * @throws {NotFoundError} If no supplier with the given `id` exists.
   * @throws {ValidationError} If a foreign-key constraint prevents deletion
   *   (e.g. the supplier is still referenced by an order).
   * @throws {DatabaseError} Re-throws any other unexpected database error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * await repo.delete(42); // resolves silently on success
   */
  async delete(id: number): Promise<void> {
    try {
      const result = await this.db.run('DELETE FROM suppliers WHERE supplier_id = ?', [id]);

      if (result.changes === 0) {
        throw new NotFoundError('Supplier', id);
      }
    } catch (error) {
      handleDatabaseError(error, 'Supplier', id);
    }
  }

  /**
   * Checks whether a supplier with the given ID exists without fetching the
   * full record. Useful as a lightweight pre-condition check.
   *
   * @param {number} id - The `supplier_id` to check.
   * @returns {Promise<boolean>} Resolves with `true` if the supplier exists,
   *   `false` otherwise.
   * @throws {DatabaseError} Re-throws any unexpected database-level error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * if (await repo.exists(42)) {
   *   // safe to proceed
   * }
   */
  async exists(id: number): Promise<boolean> {
    try {
      const result = await this.db.get<CountRow>(
        'SELECT COUNT(*) as count FROM suppliers WHERE supplier_id = ?',
        [id],
      );
      return (result?.count ?? 0) > 0;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Searches for suppliers whose `name` contains the given substring
   * (case-insensitive LIKE query).
   *
   * @param {string} name - The substring to search for within supplier names.
   *   An empty string returns all suppliers.
   * @returns {Promise<Supplier[]>} Resolves with an array of matching
   *   suppliers ordered alphabetically by name. Returns an empty array when
   *   there are no matches.
   * @throws {DatabaseError} Re-throws any unexpected database-level error.
   *
   * @example
   * const repo = await getSuppliersRepository();
   * const results = await repo.findByName('acme');
   * // [{ supplierId: 1, name: 'Acme Corp', ... }]
   */
  async findByName(name: string): Promise<Supplier[]> {
    try {
      const rows = await this.db.all<DatabaseRow>(
        'SELECT * FROM suppliers WHERE name LIKE ? ORDER BY name',
        [`%${name}%`],
      );
      return mapDatabaseRows<Supplier>(rows).map(convertBooleanFields);
    } catch (error) {
      handleDatabaseError(error);
    }
  }
}

/**
 * Factory function that creates a new {@link SuppliersRepository} bound to a
 * fresh database connection.
 *
 * Prefer {@link getSuppliersRepository} for application code. Use this
 * function when you explicitly need an independent repository instance (e.g.
 * in isolated integration tests).
 *
 * @param {boolean} [isTest=false] - When `true`, connects to the in-memory
 *   test database instead of the production database file.
 * @returns {Promise<SuppliersRepository>} A new repository instance.
 *
 * @example
 * const repo = await createSuppliersRepository(true); // in-memory DB
 */
export async function createSuppliersRepository(
  isTest: boolean = false,
): Promise<SuppliersRepository> {
  const db = await getDatabase(isTest);
  return new SuppliersRepository(db);
}

/**
 * Returns `true` when the current execution context is a test environment.
 *
 * The check covers the explicit `isTest` flag, the `NODE_ENV=test` convention
 * used by many test runners, and the `VITEST=true` variable set by Vitest.
 *
 * @param {boolean} isTest - Explicit override passed by the caller.
 * @returns {boolean}
 */
function isTestEnvironment(isTest: boolean): boolean {
  return isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

// Singleton instance for default usage
let suppliersRepo: SuppliersRepository | null = null;

/**
 * Returns the shared {@link SuppliersRepository} singleton for application
 * code, or a fresh instance when running in a test environment.
 *
 * The singleton is created lazily on the first call and reused for all
 * subsequent calls in the same process. Test environments always receive a
 * new, isolated instance to prevent state leakage between test cases.
 *
 * The test environment is detected when any of the following are true:
 * - `isTest` parameter is `true`
 * - `NODE_ENV` environment variable equals `'test'`
 * - `VITEST` environment variable equals `'true'`
 *
 * @param {boolean} [isTest=false] - Force test-database mode regardless of
 *   environment variables.
 * @returns {Promise<SuppliersRepository>} The singleton repository (or a
 *   fresh test instance).
 *
 * @example
 * // Application code
 * const repo = await getSuppliersRepository();
 * const suppliers = await repo.findAll();
 *
 * @example
 * // Inside a Vitest test
 * const repo = await getSuppliersRepository(true);
 */
export async function getSuppliersRepository(
  isTest: boolean = false,
): Promise<SuppliersRepository> {
  if (isTestEnvironment(isTest)) {
    return createSuppliersRepository(true);
  }
  if (!suppliersRepo) {
    suppliersRepo = await createSuppliersRepository(false);
  }
  return suppliersRepo;
}
