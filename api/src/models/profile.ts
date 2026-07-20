/**
 * @swagger
 * components:
 *   schemas:
 *     Profile:
 *       type: object
 *       required:
 *         - profileId
 *         - username
 *         - email
 *       properties:
 *         profileId:
 *           type: integer
 *           description: The unique identifier for the profile
 *         username:
 *           type: string
 *           description: Unique username for the user
 *         email:
 *           type: string
 *           format: email
 *           description: Email address of the user
 *         fullName:
 *           type: string
 *           description: Full display name of the user
 *         role:
 *           type: string
 *           description: Role of the user within the system
 *         department:
 *           type: string
 *           description: Department the user belongs to
 *         phone:
 *           type: string
 *           description: Contact phone number for the user
 *         isActive:
 *           type: boolean
 *           description: Whether the user profile is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: ISO 8601 timestamp when the profile was created
 */
export interface Profile {
  profileId: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}
