import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import {TagDrawerContent} from 'sentry/views/issueDetails/groupTags/tagDrawerContent';

describe('TagDrawerContent', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture({project});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
  });

  it('searches tag values for tags keyed like Object properties', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [
        {
          key: '__proto__',
          name: '__proto__',
          totalValues: 1,
          topValues: [
            {
              count: 1,
              name: 'needle',
              value: 'needle',
              lastSeen: '2018-11-16T22:52:24Z',
              firstSeen: '2018-05-06T03:48:28.855Z',
            },
          ],
        },
      ],
    });

    render(
      <GroupDataContextProvider group={group} project={project}>
        <TagDrawerContent
          group={group}
          organization={organization}
          project={project}
          environments={[]}
          search="needle"
        />
      </GroupDataContextProvider>,
      {organization}
    );

    expect(await screen.findByText('__proto__')).toBeInTheDocument();
  });
});
