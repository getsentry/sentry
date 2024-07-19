import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {TeamResolutionTimeFixture} from 'sentry-fixture/teamResolutionTime';

import {render} from 'sentry-test/reactTestingLibrary';

import TeamResolutionTime from 'sentry/views/organizationStats/teamInsights/teamResolutionTime';

describe('TeamResolutionTime', () => {
  it('should render graph of issue time to resolution', () => {
    const team = TeamFixture();
    const organization = OrganizationFixture();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/time-to-resolution/`,
      body: TeamResolutionTimeFixture(),
    });
    render(
      <TeamResolutionTime organization={organization} teamSlug={team.slug} period="8w" />
    );

    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
  });
});
