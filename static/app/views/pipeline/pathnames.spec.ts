import type {Organization} from 'sentry/types/organization';
import {makePipelinePathname} from 'sentry/views/pipeline/pathnames';

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
    expected: '/organizations/test-org-slug/pipeline/',
  },
  {
    organization: testOrg,
    path: '/test/',
    expected: '/organizations/test-org-slug/pipeline/test/',
  },
];

describe('makePipelinePathname', () => {
  describe.each(testCases)(
    'when the organization is $organization and the path is $path',
    ({organization, path, expected}) => {
      it('generates the correct url', () => {
        expect(makePipelinePathname({organization, path})).toEqual(expected);
      });
    }
  );
});
