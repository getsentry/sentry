import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogRowContent} from 'sentry/views/explore/logs/logsTableRow';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useExploreLogsTableRow} from 'sentry/views/explore/logs/useLogsQuery';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

jest.mock('sentry/views/explore/logs/useLogsQuery', () => ({
  useExploreLogsTableRow: jest.fn(),
  usePrefetchLogTableRowOnHover: jest.fn().mockReturnValue({}),
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

  const defaultAttributes: TraceItemResponseAttribute[] = [
    {
      type: 'str',
      value: '123',
      name: 'sentry.project_id',
    } as TraceItemResponseAttribute,
    {
      type: 'str',
      value: '456',
      name: OurLogKnownFieldKey.SEVERITY_NUMBER,
    } as TraceItemResponseAttribute,
    {
      type: 'str',
      value: '7b91699f',
      name: OurLogKnownFieldKey.TRACE_ID,
    } as TraceItemResponseAttribute,
  ];

  const dataRow = {
    [OurLogKnownFieldKey.ID]: 1,
    [OurLogKnownFieldKey.PROJECT_ID]: 123,
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
    [OurLogKnownFieldKey.MESSAGE]: 'test log body',
    [OurLogKnownFieldKey.SEVERITY_NUMBER]: 456,
    [OurLogKnownFieldKey.SEVERITY_TEXT]: 'error',
    [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-03T15:50:10+00:00',
  };

  beforeEach(function () {
    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('renders row details', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockedUseExploreLogsTableRow.mockReturnValue({
      data: {
        attributes: defaultAttributes,
      },
      isPending: false,
    } as unknown as ReturnType<typeof useExploreLogsTableRow>);

    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={dataRow}
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

    // Expand the row to show the attributes
    const logTableRow = await screen.findByTestId('log-table-row');
    expect(logTableRow).toBeInTheDocument();
    await userEvent.click(logTableRow);

    // Check that the attribute values are rendered
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
    expect(screen.getByText('7b91699f')).toBeInTheDocument();

    // Check that the attributes keys are rendered
    expect(screen.getByTestId('tree-key-project.id')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-project.id')).toHaveTextContent('project_id');
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
  });
});
