import {z} from 'zod';

export const DEFAULT_BRANCH = 'main';

export const sanitizeBranch = (value: string) =>
  value
    .replace(/[^\w/.-]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^[./]+/, '');

export const resolveBranch = (branch: string, fallback: string = DEFAULT_BRANCH) =>
  sanitizeBranch(branch).replace(/[./]+$/, '') || fallback;

// Only guarantees a trailing slash. Repeated slashes are left intact because
// stack prefixes legitimately contain URI schemes like app:/// and webpack:///.
export const normalizeRoot = (root: string) =>
  root === '' || root.endsWith('/') ? root : `${root}/`;

export const pathMappingSchema = z.object({
  stackRoot: z.string(),
  sourceRoot: z.string(),
  branch: z.string(),
});

export const normalizedPathMappingSchema = pathMappingSchema.extend({
  stackRoot: z.string().transform(normalizeRoot),
  sourceRoot: z.string().transform(normalizeRoot),
  branch: z.string().transform(v => resolveBranch(v)),
});
