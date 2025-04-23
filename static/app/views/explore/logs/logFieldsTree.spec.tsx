import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceIDRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldsTree} from 'sentry/views/explore/logs/logFieldsTree';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function ProviderWrapper({children}: {children?: React.ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>
      <LogsPageParamsProvider analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}>
        {children}
      </LogsPageParamsProvider>
    </QueryClientProvider>
  );
}

describe('logFieldsTree', () => {
  const organization = OrganizationFixture({
    features: ['trace-view-v1'],
  });

  beforeEach(function () {
    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('when rendering sentry.project_id, it should be aliased to project_id when rendering and when using the cell action', () => {
    const attributes: TraceItemResponseAttribute[] = [
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

    render(
      <ProviderWrapper>
        <LogFieldsTree
          attributes={attributes}
          renderers={{
            [OurLogKnownFieldKey.TRACE_ID]: TraceIDRenderer,
          }}
          renderExtra={{
            highlightTerms: [],
            logColors: {
              background: '#fff',
              backgroundLight: '#f8f8f8',
              border: '#ccc',
              borderHover: '#999',
              color: '#000',
            },
            useFullSeverityText: false,
            organization,
            location: LocationFixture(),
          }}
          tableResultLogRow={{
            [OurLogKnownFieldKey.PROJECT_ID]: 123,
            [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
            [OurLogKnownFieldKey.MESSAGE]: 'test log body',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 456,
            [OurLogKnownFieldKey.SEVERITY]: 'error',
            [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-03T15:50:10+00:00',
          }}
        />
      </ProviderWrapper>
    );

    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
    expect(screen.getByText('7b91699f')).toBeInTheDocument();

    expect(screen.getByTestId('tree-key-project.id')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-project.id')).toHaveTextContent('project_id');
    expect(screen.getByTestId('tree-key-severity_number')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-severity_number')).toHaveTextContent(
      'severity_number'
    );

    expect(screen.getByTestId('tree-key-trace')).toHaveTextContent('trace');
    const traceLink = screen.getByRole('link', {name: '7b91699f'});
    expect(traceLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/logs/trace/7b91699f/?source=logs&timestamp=1743695410'
    );
  });
});
