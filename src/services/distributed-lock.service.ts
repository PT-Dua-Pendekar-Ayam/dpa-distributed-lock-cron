import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as os from 'os';

@Injectable()
export class DistributedLockService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DistributedLockService.name);
    private client: Redis | null = null;
    private readonly nodeId: string;

    constructor(private readonly configService: ConfigService) {
        // Generate unique node identifier for lock ownership
        this.nodeId = `${os.hostname()}-${process.pid}-${Date.now()}`;
    }

    async onModuleInit(): Promise<void> {
        const host = this.configService.get<string>('distributedLock.redis.host') || 'localhost';
        const port = this.configService.get<number>('distributedLock.redis.port') || 6379;
        const password = this.configService.get<string>('distributedLock.redis.password');
        const db = this.configService.get<number>('distributedLock.redis.db') || 0;
        const keyPrefix = this.configService.get<string>('distributedLock.redis.keyPrefix') || '';

        this.client = new Redis({
            host,
            port,
            password: password || undefined,
            db,
            keyPrefix,
            retryStrategy: (times: number) => {
                if (times > 3) {
                    this.logger.error('Redis connection failed after 3 retries');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });

        this.client.on('connect', () => {
            this.logger.log(`DistributedLock: Redis connected to ${host}:${port}`);
        });

        this.client.on('error', (err: Error) => {
            this.logger.error(`DistributedLock: Redis error - ${err.message}`);
        });

        try {
            await this.client.connect();
        } catch (error) {
            this.logger.warn(`DistributedLock: Redis connection failed - ${(error as Error).message}. Locks will be disabled.`);
        }
    }

    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.logger.log('DistributedLock: Redis disconnected');
        }
    }

    /**
     * Get the Redis client instance
     */
    getClient(): Redis | null {
        return this.client;
    }

    /**
     * Get this node's unique identifier
     */
    getNodeId(): string {
        return this.nodeId;
    }

    /**
     * Check if Redis is connected
     */
    isConnected(): boolean {
        return this.client?.status === 'ready';
    }

    /**
     * Try to acquire a distributed lock using atomic SET NX PX
     * @param key Lock key name
     * @param ttlMs Lock TTL in milliseconds
     * @returns true if lock acquired, false if already locked by another node
     */
    async acquireLock(key: string, ttlMs: number): Promise<boolean> {
        if (!this.isConnected() || !this.client) {
            this.logger.warn(`DistributedLock: Redis not connected, skipping lock for ${key}`);
            return true; // Allow execution if Redis is down (fail-open)
        }

        try {
            // SET key value NX PX ttlMs - atomic operation
            const result = await this.client.set(key, this.nodeId, 'PX', ttlMs, 'NX');
            const acquired = result === 'OK';

            if (acquired) {
                this.logger.debug(`DistributedLock: Lock acquired - ${key} by ${this.nodeId}`);
            } else {
                this.logger.debug(`DistributedLock: Lock not acquired (already held) - ${key}`);
            }

            return acquired;
        } catch (error) {
            this.logger.error(`DistributedLock: Failed to acquire lock ${key} - ${(error as Error).message}`);
            return true; // Fail-open: allow execution on error
        }
    }

    /**
     * Release a distributed lock (only if we own it)
     * @param key Lock key name
     */
    async releaseLock(key: string): Promise<void> {
        if (!this.isConnected() || !this.client) {
            return;
        }

        try {
            // Only delete if we own the lock (Lua script for atomicity)
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;

            await this.client.eval(luaScript, 1, key, this.nodeId);
            this.logger.debug(`DistributedLock: Lock released - ${key}`);
        } catch (error) {
            this.logger.error(`DistributedLock: Failed to release lock ${key} - ${(error as Error).message}`);
        }
    }
}
