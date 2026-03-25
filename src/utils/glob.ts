import { glob as globFn } from 'glob';
import * as path from 'path';

export async function resolveGlob(pattern: string): Promise<string[]> {
  // If it's a direct file path (no glob chars), return as-is
  if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('{')) {
    return [pattern];
  }
  const files = await globFn(pattern, { absolute: true });
  return files.sort();
}

export function ensureAbsolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}
