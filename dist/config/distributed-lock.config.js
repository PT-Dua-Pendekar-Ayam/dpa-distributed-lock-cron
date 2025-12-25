"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributedLockConfig = void 0;
const config_1 = require("@nestjs/config");
exports.distributedLockConfig = (0, config_1.registerAs)('distributedLock', () => ({
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        keyPrefix: process.env.REDIS_KEY_PREFIX || '',
    },
}));
//# sourceMappingURL=distributed-lock.config.js.map