import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AnalyticsArea, {useAnalyticsArea} from 'sentry/components/analyticsArea';
import type {Organization} from 'sentry/types/organization';
import * as analytics from 'sentry/utils/analytics';

function TestButton({org}: {org: Organization}) {
  const area = useAnalyticsArea();

  return (
    <button
      data-test-id="my-button"
      onClick={() => {
        analytics.trackAnalytics('button-clicked', {
          organization: org,
          area,
        });
      }}
    />
  );
}

describe('AnalyticsAreaProvider', function () {
  const organization = OrganizationFixture();
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  it('Appends names when nested', async function () {
    render(
      <AnalyticsArea name="feedback">
        <AnalyticsArea name="details">
          <AnalyticsArea name="activity">
            <TestButton org={organization} />
          </AnalyticsArea>
        </AnalyticsArea>
      </AnalyticsArea>
    );

    const button = screen.getByTestId('my-button');
    await userEvent.click(button);

    expect(analyticsSpy).toHaveBeenCalledWith('button-clicked', {
      organization,
      area: 'feedback.details.activity',
    });
  });

  it('Overrides parent area when specified', async function () {
    render(
      <AnalyticsArea name="feedback">
        <AnalyticsArea name="details">
          <AnalyticsArea name="my-modal" overrideParent>
            <TestButton org={organization} />
          </AnalyticsArea>
        </AnalyticsArea>
      </AnalyticsArea>
    );

    const button = screen.getByTestId('my-button');
    await userEvent.click(button);

    expect(analyticsSpy).toHaveBeenCalledWith('button-clicked', {
      organization,
      area: 'my-modal',
    });
  });
});
