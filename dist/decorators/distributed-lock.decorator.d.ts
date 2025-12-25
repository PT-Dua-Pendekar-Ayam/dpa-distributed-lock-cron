/**
 * Interface for distributed lock configuration
 */
export interface DistributedLockConfig {
    keyName: string;
    ttlMs: number;
}
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
export declare function DistributedLock(keyName: string, ttlMs: number): MethodDecorator;
/**
 * Get distributed lock metadata from a method
 */
export declare function getDistributedLockMetadata(target: object, propertyKey: string | symbol): DistributedLockConfig | undefined;
//# sourceMappingURL=distributed-lock.decorator.d.ts.map