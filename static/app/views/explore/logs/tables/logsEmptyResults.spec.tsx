import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_INSTRUCTIONS_URL} from 'sentry/views/explore/logs/constants';
import {LogsEmptyResults} from 'sentry/views/explore/logs/tables/logsEmptyResults';
import {OrganizationContext} from 'sentry/views/organizationContext';

const organization = OrganizationFixture();

function renderWithOrganization(chldren: React.ReactNode) {
  return render(
    <OrganizationContext.Provider value={organization}>
      <table>
        <tbody>{chldren}</tbody>
      </table>
    </OrganizationContext.Provider>
  );
}

describe('LogsEmptyResults', () => {
  it('renders the default empty state when no logs are found', () => {
    renderWithOrganization(
      <LogsEmptyResults analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />
    );

    expect(screen.getByText('No logs found')).toBeInTheDocument();
    expect(
      screen.getByText(/Try adjusting your filters or get started with sending logs/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'instructions'})).toHaveAttribute(
      'href',
      LOGS_INSTRUCTIONS_URL
    );
  });

  it('renders the continue-scanning state when bytes were scanned and auto-fetch can resume', () => {
    const mockResumeAutoFetch = jest.fn();

    renderWithOrganization(
      <LogsEmptyResults
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        bytesScanned={4096}
        canResumeAutoFetch
        resumeAutoFetch={mockResumeAutoFetch}
      />
    );

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toHaveTextContent('No logs found yet');
    expect(emptyState).toHaveTextContent(
      'We scanned 4.0 KiB so far but have not found anything matching your filters'
    );
    expect(
      screen.getByText('We can keep digging or you can narrow down your search.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /continue scanning/i})).toBeInTheDocument();
  });

  it('tracks analytics and calls resumeAutoFetch when Continue Scanning is clicked', async () => {
    const trackSpy = jest.spyOn(analytics, 'trackAnalytics');
    const resumeAutoFetch = jest.fn();
    const bytesScanned = 4096;

    renderWithOrganization(
      <LogsEmptyResults
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        bytesScanned={bytesScanned}
        canResumeAutoFetch
        resumeAutoFetch={resumeAutoFetch}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /continue scanning/i}));

    expect(trackSpy).toHaveBeenCalledWith('logs.explorer.continue_searching_clicked', {
      bytes_scanned: bytesScanned,
      organization,
      page_source: LogsAnalyticsPageSource.EXPLORE_LOGS,
    });
    expect(resumeAutoFetch).toHaveBeenCalled();
  });
});
