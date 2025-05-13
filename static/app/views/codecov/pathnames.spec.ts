import type {Organization} from 'sentry/types/organization';
import {makeCodecovPathname} from 'sentry/views/codecov/pathnames';

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
    expected: '/organizations/test-org-slug/codecov/',
  },
  {
    organization: testOrg,
    path: '/test/',
    expected: '/organizations/test-org-slug/codecov/test/',
  },
];

describe('makeCodecovPathname', () => {
  describe.each(testCases)(
    'when the organization is $organization and the path is $path',
    ({organization, path, expected}) => {
      it('generates the correct url', () => {
        expect(makeCodecovPathname({organization, path})).toEqual(expected);
      });
    }
  );
});
