# @dpa/distributed-lock-cron

Distributed Lock decorator untuk NestJS cron jobs menggunakan Redis. Mencegah duplikasi eksekusi cron job di environment multi-replica (Docker Swarm, Kubernetes).

## Installation

```bash
npm install @dpa/distributed-lock-cron ioredis
```

## Quick Start

### 1. Import Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistributedLockModule, distributedLockConfig } from '@dpa/distributed-lock-cron';

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

### 3. Use Decorator

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DistributedLock, DistributedLockService } from '@dpa/distributed-lock-cron';

@Injectable()
export class MyService {
  constructor(private readonly lockService: DistributedLockService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  @DistributedLock('cron:daily-sync', 300000)  // key, TTL 5 minutes
  async dailySync(): Promise<void> {
    // Only ONE replica will execute this
    console.log('Running daily sync...');
  }
}
```

## API

### `@DistributedLock(keyName: string, ttlMs: number)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `keyName` | `string` | Unique lock key (e.g., `'cron:my-job'`) |
| `ttlMs` | `number` | Lock TTL in milliseconds |

### `DistributedLockService`

| Method | Description |
|--------|-------------|
| `acquireLock(key, ttlMs)` | Acquire lock, returns `true` if acquired |
| `releaseLock(key)` | Release lock (only if owned) |
| `isConnected()` | Check Redis connection status |

## How It Works

1. Before method execution, decorator tries to acquire lock using Redis `SET key NX PX ttl`
2. If lock acquired (returns `OK`): method executes, then lock is released
3. If lock not acquired (returns `null`): method is skipped, returns `void`
4. Lock uses Lua script for safe release (only owner can release)

## Fail-Open Behavior

If Redis is unavailable, the decorator allows execution (fail-open) to prevent blocking all replicas.

## License

MIT
