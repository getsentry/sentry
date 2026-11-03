import type {PathMappingValue} from './type';

export const DEFAULT_BRANCH = 'main';

export const sanitizeBranch = (value: string) =>
  value
    .replace(/[^\w/.-]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^[./]+/, '');

export const resolveBranch = (branch: string, fallback: string = DEFAULT_BRANCH) =>
  sanitizeBranch(branch).replace(/[./]+$/, '') || fallback;

// Mirrors the backend rule: Windows-only roots (no /) get \, everything else gets /.
export const normalizeRoot = (root: string): string => {
  if (root === '' || root.endsWith('/') || root.endsWith('\\')) {
    return root;
  }
  return root.includes('\\') && !root.includes('/') ? `${root}\\` : `${root}/`;
};

export function normalizePathMapping(
  value: PathMappingValue,
  branchFallback: string = DEFAULT_BRANCH
) {
  return {
    stackRoot: normalizeRoot(value.stackRoot),
    sourceRoot: normalizeRoot(value.sourceRoot),
    branch: resolveBranch(value.branch, branchFallback),
  };
}
