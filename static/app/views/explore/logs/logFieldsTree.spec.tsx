import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
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
  const organization = OrganizationFixture();

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
    ];

    render(
      <ProviderWrapper>
        <LogFieldsTree
          attributes={attributes}
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
            renderSeverityCircle: false,
            organization,
            location: LocationFixture(),
          }}
        />
      </ProviderWrapper>
    );

    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();

    expect(screen.getByTestId('tree-key-project.id')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-project.id')).toHaveTextContent('project_id');
    expect(screen.getByTestId('tree-key-log.severity_number')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-log.severity_number')).toHaveTextContent(
      'severity_number'
    );
  });
});
