import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {SupergroupDetailFixture} from 'sentry-fixture/supergroupDetail';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';

describe('SupergroupDetailDrawer', () => {
  const organization = OrganizationFixture();
  const issuesUrl = `/organizations/${organization.slug}/issues/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
  });

  it('hoists stream matches to the first page for supergroups too large to inline', async () => {
    // Over the inline-id limit, so hoisting takes the stream-scan path.
    const memberIds = Array.from({length: 250}, (_, i) => i + 1);
    const matchedMemberId = '100';
    const nonMemberId = '9999';

    // Page fetch: only this request has `group=`.
    const otherMembers = memberIds
      .filter(id => String(id) !== matchedMemberId)
      .slice(0, 24)
      .map(id => GroupFixture({id: String(id), title: `OTHER_${id}`}));
    MockApiClient.addMockResponse({
      url: issuesUrl,
      method: 'GET',
      body: [
        GroupFixture({id: matchedMemberId, metadata: {title: 'MATCHED_MEMBER'}}),
        ...otherMembers,
      ],
      match: [(_url, options) => Array.isArray(options.query?.group)],
    });

    // Stream scan: one member + one non-member. Only the member should hoist.
    MockApiClient.addMockResponse({
      url: issuesUrl,
      method: 'GET',
      body: [
        GroupFixture({id: matchedMemberId, metadata: {title: 'MATCHED_MEMBER'}}),
        GroupFixture({id: nonMemberId, title: 'NON_MEMBER'}),
      ],
      match: [(_url, options) => !options.query?.group],
    });

    render(
      <SupergroupDetailDrawer
        supergroup={SupergroupDetailFixture({group_ids: memberIds})}
        filterWithCurrentSearch
      />,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/issues/',
          location: {
            pathname: '/organizations/:orgId/issues/',
            query: {query: 'is:unresolved'},
          },
        },
      }
    );

    expect(await screen.findByText('MATCHED_MEMBER')).toBeInTheDocument();
    const rows = screen.getAllByTestId('group');
    expect(rows[0]).toHaveTextContent('MATCHED_MEMBER');
  });
});
