# dpa-distributed-lock-cron

[![npm version](https://badge.fury.io/js/dpa-distributed-lock-cron.svg)](https://www.npmjs.com/package/dpa-distributed-lock-cron)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Distributed Lock decorator for NestJS cron jobs using Redis. Prevents duplicate cron job execution in multi-replica environments (Docker Swarm, Kubernetes, PM2 cluster).

## ✨ Features

- 🔒 **Atomic Locking** - Uses Redis `SET NX PX` for race-condition-free locking
- 🎯 **Simple Decorator** - Just add `@DistributedLock()` to your cron method
- 🔄 **Auto Release** - Lock is automatically released after method execution
- 🛡️ **Fail-Open** - Allows execution if Redis is unavailable (configurable)
- 📦 **Zero Config** - Works out of the box with environment variables

## 📦 Installation

```bash
npm install dpa-distributed-lock-cron ioredis
```

## 🚀 Quick Start

### 1. Import Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistributedLockModule, distributedLockConfig } from 'dpa-distributed-lock-cron';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [distributedLockConfig],
    }),
    DistributedLockModule,
  ],
})
export class AppModule {}
```

### 2. Set Environment Variables

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=       # optional
REDIS_DB=0            # optional, default: 0
REDIS_KEY_PREFIX=     # optional, e.g., "myapp:"
```

### 3. Use the Decorator

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DistributedLock } from 'dpa-distributed-lock-cron';

@Injectable()
export class MyService {
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  @DistributedLock('cron:daily-sync', 300000)  // key, TTL 5 minutes
  async dailySync(): Promise<void> {
    // ✅ Only ONE replica will execute this
    console.log('Running daily sync...');
  }
}
```

## 📖 API Reference

### `@DistributedLock(keyName: string, ttlMs: number)`

Decorator to wrap your cron method with distributed locking.

| Parameter | Type | Description |
|-----------|------|-------------|
| `keyName` | `string` | Unique lock key (e.g., `'cron:my-job'`) |
| `ttlMs` | `number` | Lock TTL in milliseconds (safety timeout) |

### `DistributedLockService`

Injectable service for manual lock management.

```typescript
import { DistributedLockService } from 'dpa-distributed-lock-cron';

@Injectable()
export class MyService {
  constructor(private readonly lockService: DistributedLockService) {}

  async manualLockExample() {
    const acquired = await this.lockService.acquireLock('my-lock', 60000);
    if (acquired) {
      try {
        // do work
      } finally {
        await this.lockService.releaseLock('my-lock');
      }
    }
  }
}
```

| Method | Returns | Description |
|--------|---------|-------------|
| `acquireLock(key, ttlMs)` | `Promise<boolean>` | Acquire lock, returns `true` if acquired |
| `releaseLock(key)` | `Promise<void>` | Release lock (only if owned) |
| `isConnected()` | `boolean` | Check Redis connection status |

## ⚙️ How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │     │  Replica 3  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ SET lock NX PX    │ SET lock NX PX    │ SET lock NX PX
       │                   │                   │
       ▼                   ▼                   ▼
   ┌───────────────────────────────────────────────┐
   │                    REDIS                       │
   │  lock:cron:daily-sync = "replica-1-uuid"      │
   └───────────────────────────────────────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   ✅ Execute          ❌ Skip             ❌ Skip
```

1. Before method execution, decorator tries to acquire lock using Redis `SET key NX PX ttl`
2. If lock acquired (`OK`): method executes, then lock is released
3. If lock not acquired (`null`): method is skipped silently
4. Lock uses Lua script for safe release (only the owner can release)

## 🛡️ Fail-Open Behavior

If Redis is unavailable, the decorator allows execution (fail-open) to prevent blocking all replicas. This ensures your cron jobs continue to run even during Redis outages.

## 📋 Requirements

- Node.js >= 18.0.0
- NestJS >= 10.0.0
- Redis >= 6.0

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [DPA Team](https://github.com/PT-Dua-Pendekar-Ayam)
