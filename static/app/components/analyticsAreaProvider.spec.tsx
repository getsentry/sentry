import {useContext} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AnalyticsAreaProvider, {
  AnalyticsAreaContext,
} from 'sentry/components/analyticsAreaProvider';
import type {Organization} from 'sentry/types/organization';
import * as analytics from 'sentry/utils/analytics';

function TestButton({org}: {org: Organization}) {
  const area = useContext(AnalyticsAreaContext);

  return (
    <button
      data-test-id="my-button"
      onClick={() => {
        analytics.trackAnalytics('button-clicked', {
          organization: org,
          area: area,
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
      <AnalyticsAreaProvider name="feedback">
        <AnalyticsAreaProvider name="details">
          <AnalyticsAreaProvider name="activity">
            <TestButton org={organization} />
          </AnalyticsAreaProvider>
        </AnalyticsAreaProvider>
      </AnalyticsAreaProvider>
    );

    const button = screen.getByTestId('my-button');
    await userEvent.click(button);

    expect(analyticsSpy).toHaveBeenCalledWith('button-clicked', {
      organization: organization,
      area: 'feedback.details.activity',
    });
  });

  it('Overrides parent area when specified', async function () {
    render(
      <AnalyticsAreaProvider name="feedback">
        <AnalyticsAreaProvider name="details">
          <AnalyticsAreaProvider name="my-modal" overrideParent>
            <TestButton org={organization} />
          </AnalyticsAreaProvider>
        </AnalyticsAreaProvider>
      </AnalyticsAreaProvider>
    );

    const button = screen.getByTestId('my-button');
    await userEvent.click(button);

    expect(analyticsSpy).toHaveBeenCalledWith('button-clicked', {
      organization: organization,
      area: 'my-modal',
    });
  });
});
