import type {Organization} from 'sentry/types/organization';
import {makePreventPathname} from 'sentry/views/prevent/pathnames';

const testOrg = {
  slug: 'test-org-slug',
} as Organization;

interface TestCase {
  expected: string;
  organization: Organization;
  path: '/' | `/${string}/`;
}

const testCases: TestCase[] = [
  {
    organization: testOrg,
    path: '/',
    expected: '/organizations/test-org-slug/prevent/',
  },
  {
    organization: testOrg,
    path: '/test/',
    expected: '/organizations/test-org-slug/prevent/test/',
  },
  {
    organization: testOrg,
    path: '/tokens/',
    expected: '/organizations/test-org-slug/prevent/tokens/',
  },
  {
    organization: testOrg,
    path: '/ai-code-review/',
    expected: '/organizations/test-org-slug/prevent/ai-code-review/',
  },
];

describe('makePreventPathname', () => {
  describe.each(testCases)(
    'when the organization is $organization and the path is $path',
    ({organization, path, expected}) => {
      it('generates the correct url', () => {
        expect(makePreventPathname({organization, path})).toEqual(expected);
      });
    }
  );
});
