import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceRootEvent';
import {Title} from 'sentry/views/performance/traceDetails/traceHeader/title';
import {ErrorNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/errorNode';
import {makeTraceError} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

const rootEventResults = {
  data: undefined,
  isLoading: false,
  status: 'pending',
} as TraceRootEventQueryResults;

function makeLog(message: string) {
  return {
    [OurLogKnownFieldKey.MESSAGE]: message,
    [OurLogKnownFieldKey.SEVERITY]: 'info',
  } as OurLogsResponseItem;
}

describe('Title', () => {
  it('renders colored text without escape codes when the representative log message has ANSI codes', () => {
    render(
      <Title
        isLoading={false}
        representativeEvent={{
          event: makeLog('\x1B[31mfailed\x1B[0m to connect'),
          dataset: null,
        }}
        rootEventResults={rootEventResults}
      />
    );

    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('failed').parentElement).toHaveTextContent(
      /^failed to connect$/
    );
  });

  it('renders colored text without escape codes when the representative error title has ANSI codes', () => {
    const node = new ErrorNode(
      null,
      makeTraceError({title: '\x1B[31mfailed\x1B[0m to connect'}),
      {organization: OrganizationFixture()}
    );

    render(
      <Title
        isLoading={false}
        representativeEvent={{event: node, dataset: null}}
        rootEventResults={rootEventResults}
      />
    );

    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('failed').parentElement).toHaveTextContent(
      /^failed to connect$/
    );
  });
});
