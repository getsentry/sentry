import {Organization} from 'fixtures/js-stubs/organization';
import {Team} from 'fixtures/js-stubs/team';

import {render} from 'sentry-test/reactTestingLibrary';

import TeamResolutionTime from 'sentry/views/organizationStats/teamInsights/teamResolutionTime';

describe('TeamResolutionTime', () => {
  it('should render graph of issue time to resolution', () => {
    const team = Team();
    const organization = Organization();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/time-to-resolution/`,
      body: TeamResolutionTime(),
    });
    render(
      <TeamResolutionTime organization={organization} teamSlug={team.slug} period="8w" />
    );

    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
  });
});
