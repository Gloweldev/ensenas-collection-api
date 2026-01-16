# EnSeñas AI - Manual Técnico del Backend (v1.0)

**Versión del API:** 1.0.0
**Fecha:** 16 de Enero, 2026
**Responsable:** Equipo de Ingeniería EnSeñas AI

---

## 1. Visión General de la Arquitectura

Este servicio (`ensenas-collection-api`) es el núcleo de procesamiento y almacenamiento para la fase de recolección de datos de EnSeñas AI. Opera como un servicio RESTful stateless construido sobre **Node.js** y **Express**, orquestando la autenticación de usuarios, la asignación de tareas de grabación y la gestión presignada de subidas a almacenamiento de objetos (MinIO/S3).

### 1.1 Stack Tecnológico

| Componente | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Runtime** | Node.js v20+ | Ejecución de servidor JavaScript de alto rendimiento. |
| **Framework** | Express v4.21 | Enrutamiento y middleware ligero. |
| **ORM** | Prisma v5.22 | Manejo de base de datos PostgreSQL con tipado seguro. |
| **Database** | PostgreSQL 16 | Almacenamiento relacional de metadatos (Usuarios, Glosario). |
| **Storage** | AWS SDK v3 | Abstracción para comunicarnos con MinIO (Dev) o AWS S3 (Prod). |
| **Auth** | Firebase Admin SDK | Validación de tokens JWT y sincronización de usuarios. |
| **Validation** | Zod | Validación estricta de payloads de entrada. |

### 1.2 Diagrama de Flujo de Datos (Upload)

El sistema utiliza un patrón de **"Direct-to-Cloud Upload"** para evitar cuellos de botella en el servidor Node.js.

1.  **Frontend** solicita permiso de subida (`POST /api/v1/upload/presigned-url`).
2.  **API** valida permisos y genera una URL firmada (PUT) usando AWS SDK.
3.  **Frontend** sube el video directamente al Bucket (S3/MinIO).
4.  **Frontend** confirma la subida a la API (`POST /api/v1/upload/confirm`).
5.  **API** registra los metadatos y vincula el video al Usuario y al Glosario.

---

## 2. Configuración y Despliegue

### 2.1 Variables de Entorno (`.env`)

El sistema requiere una configuración estricta. Copie `.env.example` y configure:

```ini
# Servidor
NODE_ENV="development" # o "production"
PORT=3001

# Base de Datos (PostgreSQL connection string)
DATABASE_URL="postgresql://user:password@localhost:5432/ensenas_db?schema=public"

# Almacenamiento (S3 Compatible / MinIO)
S3_ENDPOINT="http://localhost:9000" # Dejar vacío para AWS real
S3_REGION="us-east-1"
S3_BUCKET="ensenas-videos"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_FORCE_PATH_STYLE="true" # Obligatorio para MinIO

# Autenticación (Firebase)
FIREBASE_PROJECT_ID="ensenas-ai-dev"
FIREBASE_SERVICE_ACCOUNT_PATH="./ensenas-firebase-adminsdk.json"

# Seguridad
CORS_ORIGIN="http://localhost:3000"
RATE_LIMIT_WINDOW_MS=900000 # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
```

### 2.2 Scripts Disponibles

*   `npm run dev`: Inicia el servidor con `nodemon` para recarga en caliente.
*   `npm start`: Inicia el servidor en modo producción.
*   `npm run prisma:generate`: Regenera el cliente de Prisma tras cambios en el esquema.
*   `npm run prisma:migrate`: Aplica cambios de esquema a la base de datos real.
*   `npm run prisma:seed`: Puebla la base de datos con el Glosario inicial (LSM).

---

## 3. Modelo de Datos (Prisma Schema)

La base de datos está normalizada para integridad referencial.

### 3.1 Modelo `User`
Representa a un voluntario recolector.
*   `id` (UUID): Identificador interno.
*   `firebaseUid` (String @unique): Enlace con Firebase Auth.
*   `reputationScore` (Int): Puntos acumulados por videos aprobados (Gamification).
*   `currentStreak` (Int): Días consecutivos contribuyendo.

### 3.2 Modelo `Glossary`
El catálogo de señas que necesitamos recolectar.
*   `slug` (String @unique): Identificador legible (ej: `hola`, `gracias`, `hospital`).
*   `category` (String): Verbo, Sustantivo, Saludo, Médico, etc.
*   `videoReferenceUrl` (String): URL del video "maestro" que enseña cómo hacer la seña.
*   `priority` (Int 1-5): Define qué tan urgente es recolectar esta seña.

### 3.3 Modelo `Recording`
La unidad atómica de trabajo.
*   `s3Key` (String): La ruta relativa en el bucket (ej: `raw/user-123/hola/uuid.webm`).
*   `status` (Enum): `PENDING` -> `UPLOADING` -> `APPROVED` | `REJECTED`.
*   `metadata` (JSONB): Datos técnicos (FPS, resolución, UserAgent, Device).

---

## 4. Referencia de API (Endpoints)

Todas las rutas están prefijadas con `/api/v1`.

### 4.1 Autenticación (`/auth`)

#### `POST /auth/verify`
Intercambia un Token de Firebase por una sesión de usuario en nuestra DB.
*   **Header**: `Authorization: Bearer <CONFIGURABLE_TOKEN>`
*   **Body**:
    ```json
    { "token": "eyJh..." }
    ```
*   **Lógica**:
    1.  Verifica el token con `admin.auth().verifyIdToken()`.
    2.  Busca al usuario por `firebaseUid`.
    3.  Si no existe, lo crea (Upsert).
    4.  Si existe, actualiza `lastLoginAt`.

---

### 4.2 Dashboard (`/dashboard`)

#### `GET /dashboard/stats`
Obtiene las métricas para la pantalla principal del usuario.
*   **Response**:
    ```json
    {
      "success": true,
      "data": {
        "streak": 5,
        "totalRecordings": 42,
        "level": "Junior Contributor",
        "nextMilestone": 50
      }
    }
    ```

---

### 4.3 Recolección (`/collect`, `/assignments`)

#### `GET /assignments/next`
Algoritmo de asignación inteligente. Devuelve la siguiente seña que el usuario debe grabar.
*   **Lógica**:
    1.  Busca palabras en `Glossary` con `priority` alta.
    2.  Excluye palabras que el usuario ya ha grabado (`Recording` existente).
    3.  Devuelve un objeto con `slug`, `videoReference`, y `instructions`.

#### `GET /collect/:slug`
Obtiene los detalles de una seña específica.
*   **Param**: `slug` (ej: `hospital`).

---

### 4.4 Subida de Videos (`/upload`)

#### `POST /upload/presigned-url`
**CRÍTICO**. Inicia el proceso de subida.
*   **Auth**: Requiere Token Bearer.
*   **Body**:
    ```json
    {
      "filename": "recording_123.webm",
      "contentType": "video/webm",
      "signName": "hola"
    }
    ```
*   **Proceso Interno**:
    1.  Genera una UUID v4 para el archivo.
    2.  Construye la Key S3: `raw/{userId}/{signName}/{uuid}.webm`.
    3.  Llama a `storageService.generateUploadUrl(key, contentType)`.
*   **Response**:
    ```json
    {
      "success": true,
      "data": {
        "uploadUrl": "https://s3.amazonaws.com/...", // URL temporal PUT
        "key": "raw/..."
      }
    }
    ```

#### `POST /upload/confirm`
Finaliza la transacción. El frontend llama a esto **después** de subir el binario a S3.
*   **Body**:
    ```json
    {
      "key": "raw/...",
      "signName": "hola",
      "duration": 4.5,
      "metadata": { "browser": "Chrome", "fps": 30 }
    }
    ```
*   **Action**: Crea un registro en la tabla `Recording` con estado `PENDING` (o `APPROVED` si la validación automática está activa).

---

## 5. Middleware de Seguridad y Utilidades

### 5.1 `authGuard.js`
Middleware que protege rutas privadas.
*   Extrae el Bearer Token.
*   Decodifica via Firebase Admin.
*   Inyecta `req.user` con `{ uid, email, dbUser }`.
*   Si falla: Retorna 401 Unauthorized.

### 5.2 `rateLimiter.js`
Protección contra DDOS y abuso.
*   Implementación: `express-rate-limit`.
*   Configuración: Máximo 100 peticiones por IP cada 15 minutos (configurable en `.env`).
*   Headers: Retorna `X-RateLimit-Limit` y `X-RateLimit-Remaining`.

### 5.3 Manejo de Errores (`errorHandler.js`)
Centraliza las respuestas de error para no filtrar stack traces en producción.
*   Captura excepciones asíncronas.
*   Distingue errores operacionales (4xx) de errores de sistema (5xx).

---

## 6. Servicio de Almacenamiento (`storageService.js`)

Este módulo desacopla la lógica de negocio del proveedor de nube.

### 6.1 Generación de Keys
La estructura de carpetas es semántica para permitir particionado de datos futuros:
`raw / {USER_ID} / {SIGN_SLUG} / {UUID}.{EXT}`

### 6.2 Soporte Híbrido (MinIO vs AWS)
El servicio detecta `S3_ENDPOINT` en las variables de entorno.
*   Si existe: Configura el cliente en modo `forcePathStyle` (necesario para MinIO local).
*   Si no existe: Asume AWS S3 estándar y usa la región configurada.

---

## 7. Políticas de Git y Versionado

### 7.1 Ramas
*   `main`: Producción estable.
*   `develop`: Integración de features.
*   `feat/*`: Nuevas características.

### 7.2 Convención de Commits
Usamos **Conventional Commits**:
*   `feat:` Nueva funcionalidad.
*   `fix:` Corrección de bug.
*   `docs:` Cambios solo en documentación.
*   `chore:` Configuración, dependencias.

---

## 8. Troubleshooting Común

### "Prisma Client not initialized"
*   **Causa**: No se ha ejecutado `prisma generate`.
*   **Solución**: Correr `npm run prisma:generate`.

### "S3 Access Denied"
*   **Causa**: Credenciales IAM incorrectas o Bucket Policy restrictiva.
*   **Solución**: Verificar `S3_ACCESS_KEY` y que el usuario tenga permiso `PutObject`.

### "Too many connections" (PostgreSQL)
*   **Causa**: Instancias de Prisma Client multiplicadas en Hot Reload.
*   **Solución**: Usar el patrón Singleton para la instancia de Prisma en desarrollo (`src/lib/prisma.js`).

---
**Fin del Manual Técnico**
