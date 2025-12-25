import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class DistributedLockService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private client;
    private readonly nodeId;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    /**
     * Get the Redis client instance
     */
    getClient(): Redis | null;
    /**
     * Get this node's unique identifier
     */
    getNodeId(): string;
    /**
     * Check if Redis is connected
     */
    isConnected(): boolean;
    /**
     * Try to acquire a distributed lock using atomic SET NX PX
     * @param key Lock key name
     * @param ttlMs Lock TTL in milliseconds
     * @returns true if lock acquired, false if already locked by another node
     */
    acquireLock(key: string, ttlMs: number): Promise<boolean>;
    /**
     * Release a distributed lock (only if we own it)
     * @param key Lock key name
     */
    releaseLock(key: string): Promise<void>;
}
//# sourceMappingURL=distributed-lock.service.d.ts.map