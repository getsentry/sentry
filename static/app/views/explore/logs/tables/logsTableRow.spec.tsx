import {LogFixture, LogFixtureMeta} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  LOGS_FIELDS_KEY,
  LogsPageParamsProvider,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {type TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {DEFAULT_TRACE_ITEM_HOVER_TIMEOUT} from 'sentry/views/explore/logs/constants';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

function ProviderWrapper({children}: {children?: React.ReactNode}) {
  return (
    <LogsQueryParamsProvider source="location">
      <LogsPageParamsProvider analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}>
        <table>
          <tbody>{children}</tbody>
        </table>
      </LogsPageParamsProvider>
    </LogsQueryParamsProvider>
  );
}

describe('logsTableRow', () => {
  let stacktraceLinkMock: jest.Mock;
  let releaseMock: jest.Mock;
  let rowDetailsMock: jest.Mock;
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled'],
  });
  const project = ProjectFixture();
  const projects = [project];
  const release = ReleaseFixture({authors: [UserFixture()]});
  ProjectsStore.loadInitialData(projects);

  // These are the values in the actual row - e.g., the ones loaded before you click the row
  const rowData = LogFixture({
    [OurLogKnownFieldKey.ID]: '1',
    [OurLogKnownFieldKey.PROJECT_ID]: project.id,
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    [OurLogKnownFieldKey.TRACE_ID]: '7b91699f',
    [OurLogKnownFieldKey.SEVERITY]: 'info',
  });

  // These are the detailed attributes of the row - only displayed when you click the row.
  const rowDetails = [
    ...Object.entries(rowData),
    ...Object.entries({
      [OurLogKnownFieldKey.SPAN_ID]: 'faded0',
      [OurLogKnownFieldKey.CODE_FUNCTION_NAME]: 'derp',
      [OurLogKnownFieldKey.CODE_LINE_NUMBER]: '10',
      [OurLogKnownFieldKey.CODE_FILE_PATH]: 'herp/merp/derp.py',
      [OurLogKnownFieldKey.RELEASE]: release.version, // Needed otherwise stacktrace link will also not load
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

  const rowDataWithCodeFilePath = LogFixture({
    [OurLogKnownFieldKey.ID]: '2',
    [OurLogKnownFieldKey.PROJECT_ID]: project.id,
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    // Code file path fields
    [OurLogKnownFieldKey.CODE_FUNCTION_NAME]: 'derp',
    [OurLogKnownFieldKey.CODE_LINE_NUMBER]: '10',
    [OurLogKnownFieldKey.CODE_FILE_PATH]: 'herp/merp/derp.py',
    [OurLogKnownFieldKey.RELEASE]: release.version, // Needed otherwise stacktrace link will also not load
  });

  const rowDataWithScrubbedFields = LogFixture({
    [OurLogKnownFieldKey.ID]: '3',
    [OurLogKnownFieldKey.PROJECT_ID]: project.id,
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    password: '[Filtered]',
    not_zzz_not_exact_match: 'redacted2',
  });

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
        [LOGS_SORT_BYS_KEY]: '-timestamp',
      },
    },
    route: `/organizations/:orgId/explore/logs/`,
  };

  const initialRouterConfigWithCodeFilePath = {
    ...initialRouterConfig,
    location: {
      ...initialRouterConfig.location,
      query: {
        [LOGS_FIELDS_KEY]: ['timestamp', 'message', OurLogKnownFieldKey.CODE_FILE_PATH],
        [LOGS_SORT_BYS_KEY]: '-timestamp',
      },
    },
  };

  const initialRouterConfigWithScrubbedFields = {
    ...initialRouterConfig,
    location: {
      ...initialRouterConfig.location,
      query: {
        [LOGS_FIELDS_KEY]: [
          'timestamp',
          'message',
          'password',
          'not_zzz_not_exact_match',
        ],
        [LOGS_SORT_BYS_KEY]: '-timestamp',
      },
    },
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();

    ProjectsStore.loadInitialData([project]);

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [parseInt(project.id, 10)],
        environments: [],
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );

    stacktraceLinkMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${projects[0]!.slug}/stacktrace-link/`,
      method: 'GET',
      body: {
        sourceUrl: 'https://github.com/example/repo/blob/main/file.py',
        integrations: [],
      },
    });

    releaseMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(release.version)}/`,
      body: [release],
    });

    rowDetailsMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${rowData[OurLogKnownFieldKey.ID]}/`,
      method: 'GET',
      body: {
        itemId: rowData[OurLogKnownFieldKey.ID],
        links: null,
        meta: {},
        timestamp: rowData[OurLogKnownFieldKey.TIMESTAMP],
        attributes: rowDetails,
      },
    });

    // Mock for rowDataWithCodeFilePath
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${rowDataWithCodeFilePath[OurLogKnownFieldKey.ID]}/`,
      method: 'GET',
      body: {
        itemId: rowDataWithCodeFilePath[OurLogKnownFieldKey.ID],
        links: null,
        meta: {},
        timestamp: rowDataWithCodeFilePath[OurLogKnownFieldKey.TIMESTAMP],
        attributes: Object.entries(rowDataWithCodeFilePath).map(
          ([k, v]) =>
            ({
              name: k,
              value: v,
              type: typeof v === 'string' ? 'str' : 'float',
            }) as TraceItemResponseAttribute
        ),
      },
    });

    // Mock for project details needed by AnnotatedAttributeTooltip (pii config)
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: {
        ...project,
        relayPiiConfig: JSON.stringify({
          rules: {
            0: {type: 'mac', redaction: {method: 'replace', text: 'ITS_GONE'}},
          },
          applications: {not_zzz_not_exact_match: ['0']},
        }),
      },
    });
  });

  it('hovering the row causes prefetching of the row details', async () => {
    jest.useFakeTimers();
    expect(rowDetailsMock).toHaveBeenCalledTimes(0);
    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={rowData}
          highlightTerms={[]}
          meta={LogFixtureMeta(rowData)}
          sharedHoverTimeoutRef={
            {current: null} as React.MutableRefObject<NodeJS.Timeout | null>
          }
          canDeferRenderElements
        />
      </ProviderWrapper>,
      {organization, initialRouterConfig}
    );

    expect(screen.queryByLabelText('Toggle trace details')).not.toBeInTheDocument(); // Fake button
    const row = screen.getByTestId('log-table-row');
    await userEvent.hover(row, {delay: null});

    expect(rowDetailsMock).toHaveBeenCalledTimes(0);
    expect(screen.getByLabelText('Toggle trace details')).toBeInTheDocument(); // Real button immediately rendered

    // Wrap timer advancement in act to avoid warnings
    act(() => {
      jest.advanceTimersByTime(DEFAULT_TRACE_ITEM_HOVER_TIMEOUT + 1);
    });

    await waitFor(() => {
      // Prefetching is triggered after the hover timeout
      expect(rowDetailsMock).toHaveBeenCalledTimes(1);
    });
    jest.useRealTimers();
  });

  it('renders row details', async () => {
    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={rowData}
          highlightTerms={[]}
          meta={LogFixtureMeta(rowData)}
          sharedHoverTimeoutRef={
            {
              current: null,
            } as React.MutableRefObject<NodeJS.Timeout | null>
          }
          canDeferRenderElements={false}
        />
      </ProviderWrapper>,
      {organization, initialRouterConfig}
    );

    // Check that the log body and timestamp are rendered
    expect(screen.getByText('test log body')).toBeInTheDocument();
    expect(screen.getByText('Apr 10, 2025 7:21:10.049 PM')).toBeInTheDocument(); // This is using precise timestamp on log fixture, which overrides passed regular timestamp.

    // Check that the span ID is not rendered
    expect(screen.queryByText('span_id')).not.toBeInTheDocument();

    // Expand the row to show the attributes
    const logTableRow = await screen.findByTestId('log-table-row');
    expect(logTableRow).toBeInTheDocument();

    // At this point, useStacktraceLink should not have been called with enabled: true
    expect(stacktraceLinkMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({enabled: true})
    );
    expect(releaseMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({enabled: true})
    );

    expect(rowDetailsMock).toHaveBeenCalledTimes(0);
    expect(stacktraceLinkMock).toHaveBeenCalledTimes(0);
    expect(releaseMock).toHaveBeenCalledTimes(0);

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

    await waitFor(() => {
      expect(rowDetailsMock).toHaveBeenCalledTimes(1);
    });

    // Even after clicking, useStacktraceLink should be called with enabled: true since the details have disableLazyLoad: true
    expect(stacktraceLinkMock).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      expect.objectContaining({
        query: expect.objectContaining({
          lineNo: 10,
          file: 'herp/merp/derp.py',
          sdkName: 'sentry.python',
        }),
      })
    );

    // Check that the attribute values are rendered
    expect(screen.queryByText(projects[0]!.id)).not.toBeInTheDocument();
    expect(screen.getAllByText('info')).toHaveLength(2); // Severity circle and text
    expect(screen.getByText('7b91699f')).toBeInTheDocument();

    // Check that the attributes keys are rendered
    expect(screen.getByTestId('tree-key-severity')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-severity')).toHaveTextContent('severity');

    // Check that the custom renderer works
    expect(screen.getByTestId('tree-key-trace')).toHaveTextContent('trace');
    const traceLink = screen.getByRole('link', {name: '7b91699f'});
    expect(traceLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/logs/trace/7b91699f/?logsSortBys=-timestamp&source=logs&timestamp=1743695410'
    );

    // The code file path should be rendered but not as a link until hover
    expect(screen.getByText('herp/merp/derp.py')).toBeInTheDocument();

    // Verify that useStacktraceLink was not called with enabled: true
    expect(stacktraceLinkMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({enabled: true})
    );
  });

  it('shows a link when hovering over code file path in the table', async () => {
    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={rowDataWithCodeFilePath}
          highlightTerms={[]}
          meta={LogFixtureMeta(rowDataWithCodeFilePath)}
          sharedHoverTimeoutRef={
            {
              current: null,
            } as React.MutableRefObject<NodeJS.Timeout | null>
          }
          canDeferRenderElements={false}
        />
      </ProviderWrapper>,
      {organization, initialRouterConfig: initialRouterConfigWithCodeFilePath}
    );

    // Expand the row to show the attributes
    const logTableRow = await screen.findByTestId('log-table-row');
    expect(logTableRow).toBeInTheDocument();

    // At this point, useStacktraceLink should not have been called with enabled: true
    expect(stacktraceLinkMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({enabled: true})
    );
    expect(releaseMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({enabled: true})
    );

    expect(rowDetailsMock).toHaveBeenCalledTimes(0);
    expect(stacktraceLinkMock).toHaveBeenCalledTimes(0);
    expect(releaseMock).toHaveBeenCalledTimes(0);

    // Find the hoverable code path element
    const codePathElement = await screen.findByTestId('hoverable-code-path');
    expect(codePathElement).toBeInTheDocument();

    // Verify the file path is displayed
    const filePath = 'herp/merp/derp.py';
    expect(screen.getByText(filePath)).toBeInTheDocument();

    // Initially, useStacktraceLink should not have been called with enabled: true
    expect(stacktraceLinkMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({enabled: true})
    );

    // Hover over the code path
    await userEvent.hover(codePathElement);

    await waitFor(() => {
      expect(stacktraceLinkMock).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        expect.objectContaining({
          query: expect.objectContaining({
            lineNo: 10,
            file: 'herp/merp/derp.py',
          }),
        })
      );
    });

    const link = await screen.findByTestId('hoverable-code-path-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/example/repo/blob/main/file.py'
    );
  });

  it('copies log as JSON when Copy as JSON button is clicked', async () => {
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
    });

    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={rowData}
          highlightTerms={[]}
          meta={LogFixtureMeta(rowData)}
          sharedHoverTimeoutRef={
            {
              current: null,
            } as React.MutableRefObject<NodeJS.Timeout | null>
          }
          canDeferRenderElements={false}
        />
      </ProviderWrapper>,
      {organization, initialRouterConfig}
    );

    // Expand the row to show the action buttons
    const logTableRow = await screen.findByTestId('log-table-row');
    await userEvent.click(logTableRow);

    await waitFor(() => {
      expect(rowDetailsMock).toHaveBeenCalledTimes(1);
    });

    // Find and click the Copy as JSON button
    const copyButton = await screen.findByRole('button', {name: 'Copy as JSON'});
    expect(copyButton).toBeInTheDocument();

    await userEvent.click(copyButton);

    // Verify clipboard was called with JSON representation of the log
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockWriteText.mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs).toHaveLength(1);

    const copiedText = callArgs![0];
    expect(typeof copiedText).toBe('string');

    // Verify it's valid JSON
    expect(() => JSON.parse(copiedText)).not.toThrow();

    // Verify it contains expected log data
    const parsedData = JSON.parse(copiedText);
    expect(parsedData).toMatchObject({
      message: 'test log body',
      trace: '7b91699f',
      severity: 'info',
      item_id: '1',
    });

    // Verify the JSON structure matches what ourlogToJson produces
    expect(parsedData).toHaveProperty('item_id', '1');
    expect(parsedData[OurLogKnownFieldKey.TIMESTAMP_PRECISE]).toBeDefined();
    expect(parsedData).not.toHaveProperty('sentry.item_id');
  });

  it('renders fields with data scrubbing meta information', async () => {
    const traceItemMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${rowDataWithScrubbedFields[OurLogKnownFieldKey.ID]}/`,
      method: 'GET',
      body: {
        itemId: rowDataWithScrubbedFields[OurLogKnownFieldKey.ID],
        links: null,
        timestamp: rowDataWithScrubbedFields[OurLogKnownFieldKey.TIMESTAMP],
        attributes: Object.entries(rowDataWithScrubbedFields).map(
          ([k, v]) =>
            ({
              name: k,
              value: v,
              type: typeof v === 'string' ? 'str' : 'float',
            }) as TraceItemResponseAttribute
        ),
        meta: {
          password: {
            meta: {
              value: {
                '': {
                  rem: [['@password:filter', 's', 0, 10]],
                  len: 9,
                },
              },
            },
          },
          not_zzz_not_exact_match: {
            meta: {
              value: {
                '': {
                  rem: [['project:0', 's', 0, 10]],
                  len: 15,
                },
              },
            },
          },
        },
      },
    });

    render(
      <ProviderWrapper>
        <LogRowContent
          dataRow={rowDataWithScrubbedFields}
          highlightTerms={[]}
          meta={LogFixtureMeta(rowDataWithScrubbedFields)}
          sharedHoverTimeoutRef={
            {
              current: null,
            } as React.MutableRefObject<NodeJS.Timeout | null>
          }
          canDeferRenderElements={false}
        />
      </ProviderWrapper>,
      {organization, initialRouterConfig: initialRouterConfigWithScrubbedFields}
    );

    const logTableRow = await screen.findByTestId('log-table-row');
    expect(logTableRow).toBeInTheDocument();

    expect(traceItemMock).toHaveBeenCalledTimes(0);
    await userEvent.hover(logTableRow);

    await waitFor(() => {
      expect(traceItemMock).toHaveBeenCalledTimes(1);
    });

    const passwordCell = screen.getByTestId('log-table-cell-password');
    const customRuleCell = screen.getByTestId('log-table-cell-not_zzz_not_exact_match');

    expect(passwordCell).toBeInTheDocument();
    expect(passwordCell).toHaveTextContent('[Filtered]');
    expect(customRuleCell).toBeInTheDocument();
    expect(customRuleCell).toHaveTextContent('redacted2');

    const filteredText = screen.getByText(/Filtered/);
    await userEvent.hover(filteredText);

    expect(
      await screen.findByText(
        /because of a data scrubbing rule in the settings of the project/
      )
    ).toBeInTheDocument();

    await userEvent.unhover(filteredText);

    const redactedText = screen.getByText(/redacted2/);
    await userEvent.hover(redactedText);

    expect(
      await screen.findByText(
        /\[Replace\] \[MAC addresses\] with \[ITS_GONE\] from \[not_zzz_not_exact_match\]/
      )
    ).toBeInTheDocument();
  });
});
