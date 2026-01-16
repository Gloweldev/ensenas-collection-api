# EnSeñas Collection API

Cloud-agnostic Node.js/Express backend for EnSeñas AI video data collection.

## Quick Start

```bash
cp .env.example .env
npm install
npm run prisma:migrate
npm run dev
```

## Features

- ✅ Cloud-agnostic S3 storage (MinIO or AWS)
- ✅ Firebase authentication  
- ✅ Presigned URLs (no video streaming)
- ✅ Rate limiting
- ✅ Clean architecture

## API Endpoints

**Health**: `GET /api/v1/health`

**Upload**: `POST /api/v1/upload/presigned-url` (Auth required)

## Migration: Pi → AWS

Change `.env` only, zero code changes needed.
