"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var DistributedLockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedLockService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const os = __importStar(require("os"));
let DistributedLockService = DistributedLockService_1 = class DistributedLockService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(DistributedLockService_1.name);
        this.client = null;
        // Generate unique node identifier for lock ownership
        this.nodeId = `${os.hostname()}-${process.pid}-${Date.now()}`;
    }
    async onModuleInit() {
        const host = this.configService.get('distributedLock.redis.host') || 'localhost';
        const port = this.configService.get('distributedLock.redis.port') || 6379;
        const password = this.configService.get('distributedLock.redis.password');
        const db = this.configService.get('distributedLock.redis.db') || 0;
        const keyPrefix = this.configService.get('distributedLock.redis.keyPrefix') || '';
        this.client = new ioredis_1.default({
            host,
            port,
            password: password || undefined,
            db,
            keyPrefix,
            retryStrategy: (times) => {
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
        this.client.on('error', (err) => {
            this.logger.error(`DistributedLock: Redis error - ${err.message}`);
        });
        try {
            await this.client.connect();
        }
        catch (error) {
            this.logger.warn(`DistributedLock: Redis connection failed - ${error.message}. Locks will be disabled.`);
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.logger.log('DistributedLock: Redis disconnected');
        }
    }
    /**
     * Get the Redis client instance
     */
    getClient() {
        return this.client;
    }
    /**
     * Get this node's unique identifier
     */
    getNodeId() {
        return this.nodeId;
    }
    /**
     * Check if Redis is connected
     */
    isConnected() {
        return this.client?.status === 'ready';
    }
    /**
     * Try to acquire a distributed lock using atomic SET NX PX
     * @param key Lock key name
     * @param ttlMs Lock TTL in milliseconds
     * @returns true if lock acquired, false if already locked by another node
     */
    async acquireLock(key, ttlMs) {
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
            }
            else {
                this.logger.debug(`DistributedLock: Lock not acquired (already held) - ${key}`);
            }
            return acquired;
        }
        catch (error) {
            this.logger.error(`DistributedLock: Failed to acquire lock ${key} - ${error.message}`);
            return true; // Fail-open: allow execution on error
        }
    }
    /**
     * Release a distributed lock (only if we own it)
     * @param key Lock key name
     */
    async releaseLock(key) {
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
        }
        catch (error) {
            this.logger.error(`DistributedLock: Failed to release lock ${key} - ${error.message}`);
        }
    }
};
exports.DistributedLockService = DistributedLockService;
exports.DistributedLockService = DistributedLockService = DistributedLockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DistributedLockService);
//# sourceMappingURL=distributed-lock.service.js.map