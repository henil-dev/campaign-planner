// Imported first by server.js so .env values exist before any other module reads process.env.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* no .env file, use real env */ }
