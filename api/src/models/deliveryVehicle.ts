/**
 * @swagger
 * components:
 *   schemas:
 *     DeliveryVehicle:
 *       type: object
 *       required:
 *         - deliveryVehicleId
 *         - branchId
 *         - licensePlate
 *         - model
 *         - capacityKg
 *         - status
 *       properties:
 *         deliveryVehicleId:
 *           type: integer
 *           description: The unique identifier for the delivery vehicle
 *         branchId:
 *           type: integer
 *           description: The branch ID this vehicle belongs to
 *         licensePlate:
 *           type: string
 *           description: Vehicle license plate number
 *         model:
 *           type: string
 *           description: Vehicle model name
 *         capacityKg:
 *           type: number
 *           description: Maximum payload capacity in kilograms
 *         status:
 *           type: string
 *           description: Operational status of the vehicle
 *           enum: [active, maintenance, inactive]
 */
export interface DeliveryVehicle {
  deliveryVehicleId: number;
  branchId: number;
  licensePlate: string;
  model: string;
  capacityKg: number;
  status: string;
}
