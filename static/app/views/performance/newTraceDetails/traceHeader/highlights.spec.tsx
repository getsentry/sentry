import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {Highlights} from 'sentry/views/performance/newTraceDetails/traceHeader/highlights';

function makeTraceItemDetailsResponse(
  attributes: TraceItemResponseAttribute[]
): TraceItemDetailsResponse {
  return {
    itemId: 'span-1',
    timestamp: '2024-01-01T00:00:00Z',
    meta: {},
    attributes,
  };
}

describe('Highlights', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  it('renders user, os, browser, and runtime highlights from EAP span attributes', () => {
    const rootEventResults = {
      data: makeTraceItemDetailsResponse([
        {name: 'user.email', type: 'str', value: 'user@example.com'},
        {name: 'os.name', type: 'str', value: 'Windows'},
        {name: 'os.version', type: 'str', value: '10'},
        {name: 'browser.name', type: 'str', value: 'Chrome'},
        {name: 'browser.version', type: 'str', value: '120.0'},
        {name: 'runtime.name', type: 'str', value: 'node'},
        {name: 'runtime.version', type: 'str', value: '18.0.0'},
      ]),
    } as TraceRootEventQueryResults;

    render(
      <Highlights
        rootEventResults={rootEventResults}
        organization={organization}
        project={project}
      />
    );

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('120.0')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.getByText('18.0.0')).toBeInTheDocument();
  });

  it('prefers process.runtime.name/version over the deprecated runtime.name/version', () => {
    const rootEventResults = {
      data: makeTraceItemDetailsResponse([
        {name: 'process.runtime.name', type: 'str', value: 'CPython'},
        {name: 'process.runtime.version', type: 'str', value: '3.12.0'},
        {name: 'runtime.name', type: 'str', value: 'node'},
        {name: 'runtime.version', type: 'str', value: '18.0.0'},
      ]),
    } as TraceRootEventQueryResults;

    render(
      <Highlights
        rootEventResults={rootEventResults}
        organization={organization}
        project={project}
      />
    );

    expect(screen.getByText('CPython')).toBeInTheDocument();
    expect(screen.getByText('3.12.0')).toBeInTheDocument();
    expect(screen.queryByText('node')).not.toBeInTheDocument();
    expect(screen.queryByText('18.0.0')).not.toBeInTheDocument();
  });

  it('does not render os, browser, or runtime highlights when name attribute is missing', () => {
    const rootEventResults = {
      data: makeTraceItemDetailsResponse([
        {name: 'os.version', type: 'str', value: '10'},
        {name: 'browser.version', type: 'str', value: '120.0'},
        {name: 'runtime.version', type: 'str', value: '18.0.0'},
      ]),
    } as TraceRootEventQueryResults;

    render(
      <Highlights
        rootEventResults={rootEventResults}
        organization={organization}
        project={project}
      />
    );

    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('120.0')).not.toBeInTheDocument();
    expect(screen.queryByText('18.0.0')).not.toBeInTheDocument();
  });
});
