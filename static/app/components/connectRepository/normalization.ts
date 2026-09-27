import {z} from 'zod';

export const DEFAULT_BRANCH = 'main';

export const sanitizeBranch = (value: string) =>
  value
    .replace(/[^\w/.-]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^[./]+/, '');

export const resolveBranch = (branch: string) =>
  sanitizeBranch(branch).replace(/[./]+$/, '') || DEFAULT_BRANCH;

export const normalizeRoot = (root: string) => {
  const cleaned = root.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return cleaned === '' ? '' : `${cleaned}/`;
};

const schema = z.object({
  stackRoot: z.string(),
  sourceRoot: z.string(),
  branch: z.string(),
});

export const normalizedPathMappingSchema = schema.extend({
  stackRoot: z.string().transform(normalizeRoot),
  sourceRoot: z.string().transform(normalizeRoot),
  branch: z.string().transform(resolveBranch),
});
