import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_INSTRUCTIONS_URL} from 'sentry/views/explore/logs/constants';
import {LogsEmptyResults} from 'sentry/views/explore/logs/tables/logsEmptyResults';

const organization = OrganizationFixture();

function TableBodyWrapper({children}: {children?: React.ReactNode}) {
  return (
    <table>
      <tbody>{children}</tbody>
    </table>
  );
}

describe('LogsEmptyResults', () => {
  it('renders the default empty state when no logs are found', () => {
    render(
      <LogsEmptyResults analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS} />,
      {
        organization,
        additionalWrapper: TableBodyWrapper,
      }
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

    render(
      <LogsEmptyResults
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        bytesScanned={4096}
        canResumeAutoFetch
        resumeAutoFetch={mockResumeAutoFetch}
      />,
      {organization, additionalWrapper: TableBodyWrapper}
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

    render(
      <LogsEmptyResults
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        bytesScanned={bytesScanned}
        canResumeAutoFetch
        resumeAutoFetch={resumeAutoFetch}
      />,
      {organization, additionalWrapper: TableBodyWrapper}
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
