import {LocationFixture} from 'sentry-fixture/locationFixture';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useStacktraceLink from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useExploreLogsTableRow} from 'sentry/views/explore/logs/useLogsQuery';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

jest.mock('sentry/views/explore/logs/useLogsQuery', () => ({
  useExploreLogsTableRow: jest.fn(),
  usePrefetchLogTableRowOnHover: jest.fn().mockReturnValue({}),
}));

jest.mock('sentry/components/events/interfaces/frame/useStacktraceLink', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseStacktraceLink = jest.mocked(useStacktraceLink);

jest.mock('sentry/utils/useRelease', () => ({
  useRelease: jest.fn().mockReturnValue({
    data: {
      id: 10,
      lastCommit: {
        id: '1e5a9462e6ac23908299b218e18377837297bda1',
      },
    },
  }),
}));
const mockedUseExploreLogsTableRow = jest.mocked(useExploreLogsTableRow);

function ProviderWrapper({children}: {children?: React.ReactNode}) {
  return (
    <LogsPageParamsProvider analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}>
      {children}
    </LogsPageParamsProvider>
  );
}

describe('logsTableRow', () => {
  const organization = OrganizationFixture({
    features: ['trace-view-v1'],
  });

  const projects = [ProjectFixture()];
  ProjectsStore.loadInitialData(projects);

  // These are the values in the actual row - e.g., the ones loaded before you click the row
  const rowData = LogFixture({
    [OurLogKnownFieldKey.ID]: '1',
    [OurLogKnownFieldKey.PROJECT_ID]: String(projects[0]!.id),
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    [OurLogKnownFieldKey.MESSAGE]: 'test log body',
    [OurLogKnownFieldKey.SEVERITY_NUMBER]: 456,
    [OurLogKnownFieldKey.TRACE_ID]: '7b91699f',
  });

  // These are the detailed attributes of the row - only displayed when you click the row.
  const rowDetails = [
    ...Object.entries(rowData),
    ...Object.entries({
      [OurLogKnownFieldKey.SPAN_ID]: 'faded0',
      [OurLogKnownFieldKey.CODE_FUNCTION_NAME]: 'derp',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: '10',
      [OurLogKnownFieldKey.CODE_FILE_PATH]: 'herp/merp/derp.py',
      [OurLogKnownFieldKey.SDK_NAME]: 'sentry.python',
      [OurLogKnownFieldKey.SDK_VERSION]: '2.27.0',
    }),
  ].map(
    ([k, v]) =>
      ({
        name: k,
        value: v,
        type: typeof v === 'string' ? 'str' : 'float',
      }) as TraceItemResponseAttribute
  );

  beforeEach(function () {
    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('renders row details', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockedUseExploreLogsTableRow.mockReturnValue({
      data: {
        attributes: rowDetails,
      },
      isPending: false,
    } as unknown as ReturnType<typeof useExploreLogsTableRow>);

    mockedUseStacktraceLink.mockReturnValue({
      data: {
        sourceUrl: 'https://some-stacktrace-link',
        integrations: [],
      },
      error: null,
      isPending: false,
    } as unknown as ReturnType<typeof useStacktraceLink>);

    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={rowData}
          highlightTerms={[]}
          meta={undefined}
          sharedHoverTimeoutRef={
            {
              current: null,
            } as React.MutableRefObject<NodeJS.Timeout | null>
          }
        />
      </ProviderWrapper>,
      {organization}
    );

    // Check that the log body and timestamp are rendered
    expect(screen.getByText('test log body')).toBeInTheDocument();
    expect(screen.getByText('2025-04-03T15:50:10+00:00')).toBeInTheDocument();

    // Check that the span ID is not rendered
    expect(screen.queryByText('span_id')).not.toBeInTheDocument();

    // Expand the row to show the attributes
    const logTableRow = await screen.findByTestId('log-table-row');
    expect(logTableRow).toBeInTheDocument();
    await userEvent.click(logTableRow);

    // Check that there is nothing overflowing in the table row
    function hasNoWrapRecursive(element: HTMLElement) {
      const children = element.children;
      for (const child of children) {
        if (getComputedStyle(child).whiteSpace === 'nowrap') {
          return true;
        }
        if (child instanceof HTMLElement && hasNoWrapRecursive(child)) {
          return true;
        }
      }
      return false;
    }
    expect(hasNoWrapRecursive(logTableRow)).toBe(false);

    // Check that the attribute values are rendered
    expect(screen.queryByText(projects[0]!.id)).not.toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
    expect(screen.getByText('7b91699f')).toBeInTheDocument();

    // Check that the attributes keys are rendered
    expect(screen.getByTestId('tree-key-severity_number')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-severity_number')).toHaveTextContent(
      'severity_number'
    );

    // Check that the custom renderer works
    expect(screen.getByTestId('tree-key-trace')).toHaveTextContent('trace');
    const traceLink = screen.getByRole('link', {name: '7b91699f'});
    expect(traceLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/logs/trace/7b91699f/?source=logs&timestamp=1743695410'
    );

    // Check that stack trace links work
    expect(mockedUseStacktraceLink).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          release: {id: 10, lastCommit: {id: '1e5a9462e6ac23908299b218e18377837297bda1'}},
          sdk: {name: 'sentry.python', version: '2.27.0'},
        },
        frame: {
          filename: 'herp/merp/derp.py',
          function: 'derp',
          lineNo: 10,
        },
        orgSlug: 'org-slug',
        projectSlug: projects[0]!.slug,
      })
    );
    const codeLink = screen.getByText('herp/merp/derp.py').closest('a');
    expect(codeLink).toHaveAttribute('href', 'https://some-stacktrace-link');
  });
});
