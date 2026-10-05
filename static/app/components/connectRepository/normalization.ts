import type {PathMappingValue} from './type';

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
