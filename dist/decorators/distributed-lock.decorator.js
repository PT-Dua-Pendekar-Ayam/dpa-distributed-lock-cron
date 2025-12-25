"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedLock = DistributedLock;
exports.getDistributedLockMetadata = getDistributedLockMetadata;
const common_1 = require("@nestjs/common");
/**
 * Metadata key for storing distributed lock configuration
 */
const DISTRIBUTED_LOCK_METADATA = 'distributed_lock_metadata';
/**
 * @DistributedLock decorator
 *
 * Ensures only one instance of a method runs across all replicas in a distributed system.
 * Uses Redis SET NX PX for atomic lock acquisition.
 *
 * @param keyName - Unique key name for the lock (e.g., 'cron:sync-attendance')
 * @param ttlMs - Lock TTL in milliseconds (should be longer than expected execution time)
 *
 * @example
 * ```typescript
 * @Cron(CronExpression.EVERY_DAY_AT_6AM)
 * @DistributedLock('cron:daily-sync', 300000) // 5 minutes TTL
 * async scheduledSync(): Promise<void> {
 *     // This will only run on one replica
 * }
 * ```
 *
 * @requires DistributedLockService must be injected as `lockService` in the class constructor
 */
function DistributedLock(keyName, ttlMs) {
    return function (target, propertyKey, descriptor) {
        // Store metadata for potential inspection
        Reflect.defineMetadata(DISTRIBUTED_LOCK_METADATA, { keyName, ttlMs }, target, propertyKey);
        const originalMethod = descriptor.value;
        const logger = new common_1.Logger(`DistributedLock:${String(propertyKey)}`);
        descriptor.value = async function (...args) {
            // Get DistributedLockService from the instance (injected via constructor)
            const lockService = this.lockService;
            if (!lockService) {
                logger.warn(`DistributedLockService not injected in ${target.constructor.name}. ` +
                    `Make sure to inject DistributedLockService as 'lockService' in the constructor. ` +
                    `Executing method without lock.`);
                return originalMethod.apply(this, args);
            }
            // Try to acquire lock
            const lockKey = `lock:${keyName}`;
            const acquired = await lockService.acquireLock(lockKey, ttlMs);
            if (!acquired) {
                logger.log(`Skipping ${String(propertyKey)} - lock held by another node`);
                return; // Skip execution, return void without error
            }
            try {
                logger.log(`Executing ${String(propertyKey)} with distributed lock`);
                const result = await originalMethod.apply(this, args);
                return result;
            }
            finally {
                // Always release lock after execution
                await lockService.releaseLock(lockKey);
            }
        };
        return descriptor;
    };
}
/**
 * Get distributed lock metadata from a method
 */
function getDistributedLockMetadata(target, propertyKey) {
    return Reflect.getMetadata(DISTRIBUTED_LOCK_METADATA, target, propertyKey);
}
//# sourceMappingURL=distributed-lock.decorator.js.map