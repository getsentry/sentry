import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types/group';
import {BreachedMetricInvestigationSection} from 'sentry/views/issueDetails/sidebar/breachedMetricInvestigationSection';

describe('BreachedMetricInvestigationSection', () => {
  const organization = OrganizationFixture({
    features: ['investigations', 'investigations-query-execution'],
  });
  const group = GroupFixture({
    id: '123',
    issueCategory: IssueCategory.METRIC,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('launches an investigation from a breached metric sidebar', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/breached-metric/status/`,
      method: 'POST',
      body: {
        items: {
          [group.id]: {status: 'investigate', openPeriodId: '456'},
        },
      },
    });
    const launchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/breached-metric/launch/`,
      method: 'POST',
      body: {id: 'investigation-id'},
    });

    const {router} = render(<BreachedMetricInvestigationSection group={group} />, {
      organization,
    });

    expect(screen.getByText('Investigation')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Investigate'}));

    expect(launchRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {groupId: group.id, openPeriodId: '456'},
      })
    );
    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/seer/investigation-id/`
    );
  });

  it('does not render for non-metric issues', () => {
    const {container} = render(
      <BreachedMetricInvestigationSection
        group={GroupFixture({issueCategory: IssueCategory.ERROR})}
      />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });
});
