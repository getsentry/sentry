import {
  SEARCH_PAGE__SERVER_RENDERING__TYPE,
  SEARCH_SENTRY__LINK__TYPE,
} from '@sentry/conventions/attributes/search';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

import {
  ServerRenderingSection,
  type ServerRenderingSectionProps,
} from './serverRendering';

const RENDER_SPAN_ID = 'b415e097df49bf1c';
const RENDER_TRACE_ID = '6edf623ed48e4172a54e7fbee3b40c5d';
const REQUEST_SPAN_ID = 'c526f1a8e05ac02d';
const REQUEST_TRACE_ID = '7fe0734fe59f5283b65f8acff4c51d6e';

describe('ServerRenderingSection', () => {
  const organization = OrganizationFixture();
  const location = LocationFixture();

  function makeNode(op = 'pageload') {
    return new EapSpanNode(
      null,
      makeEAPSpan({event_id: 'pageload-span-id', op, is_transaction: true}),
      {organization}
    );
  }

  function typeAttribute(value: string): TraceItemResponseAttribute[] {
    return [{name: SEARCH_PAGE__SERVER_RENDERING__TYPE, type: 'str', value}];
  }

  function makeLink(
    type: 'cache_origin' | 'server_request',
    sampled = true
  ): TraceItemResponseLink {
    return {
      itemId: type === 'cache_origin' ? RENDER_SPAN_ID : REQUEST_SPAN_ID,
      traceId: type === 'cache_origin' ? RENDER_TRACE_ID : REQUEST_TRACE_ID,
      sampled,
      attributes: [{name: SEARCH_SENTRY__LINK__TYPE, type: 'str', value: type}],
    };
  }

  function renderSection(
    props: Pick<ServerRenderingSectionProps, 'attributes' | 'links'> &
      Partial<ServerRenderingSectionProps>
  ) {
    return render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <ServerRenderingSection
          node={makeNode()}
          location={location}
          organization={organization}
          onTabScrollToNode={jest.fn()}
          {...props}
        />
      </TraceStateProvider>
    );
  }

  it('renders nothing for a span that is not a pageload', () => {
    const {container} = renderSection({
      node: makeNode('http.server'),
      attributes: typeAttribute('static'),
      links: [makeLink('cache_origin')],
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a page that the server rendered in this trace', () => {
    const {container} = renderSection({attributes: []});

    expect(container).toBeEmptyDOMElement();
  });

  it('links the render of a static page', () => {
    renderSection({
      attributes: typeAttribute('static'),
      links: [makeLink('cache_origin')],
    });

    expect(screen.getByText('Server Rendering')).toBeInTheDocument();
    expect(screen.getByText('Static')).toBeInTheDocument();
    expect(screen.getByText('Whole page')).toBeInTheDocument();
    expect(screen.getByText('Rendered earlier and reused')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Open trace'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/trace/${RENDER_TRACE_ID}/`)
    );
    expect(screen.queryByText('Dynamic part')).not.toBeInTheDocument();
  });

  it('says when the render of a static page has no trace', () => {
    renderSection({attributes: typeAttribute('static')});

    expect(screen.getByText('No linked trace')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Open trace'})).not.toBeInTheDocument();
  });

  it('does not open a render whose trace was not sampled', () => {
    renderSection({
      attributes: typeAttribute('static'),
      links: [makeLink('cache_origin', false)],
    });

    expect(screen.getByText('Not sampled')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Open trace'})).not.toBeInTheDocument();
  });

  function makeServerSpan(parent: EapSpanNode, eventId: string, startTimestamp: number) {
    const serverSpan = new EapSpanNode(
      parent,
      makeEAPSpan({
        event_id: eventId,
        op: 'http.server',
        start_timestamp: startTimestamp,
        end_timestamp: startTimestamp + 0.24,
      }),
      {organization}
    );
    parent.children.push(serverSpan);
    return serverSpan;
  }

  /** Like the tree after it moves the server request of the page below the pageload. */
  function makePageloadWithServerRequest() {
    const pageload = makeNode();
    const serverRequest = makeServerSpan(pageload, 'server-span-id', 1);
    serverRequest.reparent_reason = 'pageload server handler';
    return {pageload, serverRequest};
  }

  it('shows the static part and the dynamic part of a partially static page', () => {
    renderSection({
      attributes: typeAttribute('partially_static'),
      links: [makeLink('cache_origin')],
    });

    expect(screen.getByText('Partially static')).toBeInTheDocument();
    expect(screen.getByText('Static part')).toBeInTheDocument();
    expect(screen.getByText('Dynamic part')).toBeInTheDocument();
    expect(screen.getByText('Rendered for this page load')).toBeInTheDocument();
  });

  it('selects the server span of this trace when Go to span is clicked', async () => {
    const onTabScrollToNode = jest.fn();
    const {pageload, serverRequest} = makePageloadWithServerRequest();
    renderSection({
      node: pageload,
      attributes: typeAttribute('partially_static'),
      links: [makeLink('cache_origin')],
      onTabScrollToNode,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Go to span'}));

    expect(onTabScrollToNode).toHaveBeenCalledTimes(1);
    expect(onTabScrollToNode).toHaveBeenCalledWith(serverRequest);
  });

  it('selects the server request of the page, not an API request of the page', async () => {
    const onTabScrollToNode = jest.fn();
    const {pageload, serverRequest} = makePageloadWithServerRequest();
    makeServerSpan(pageload, 'api-span-id', 2);
    renderSection({
      node: pageload,
      attributes: typeAttribute('partially_static'),
      links: [makeLink('cache_origin')],
      onTabScrollToNode,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Go to span'}));

    expect(onTabScrollToNode).toHaveBeenCalledWith(serverRequest);
  });

  it('offers no Go to span when the server span is not in the tree', () => {
    renderSection({
      attributes: typeAttribute('partially_static'),
      links: [makeLink('cache_origin')],
    });

    expect(screen.queryByRole('button', {name: 'Go to span'})).not.toBeInTheDocument();
  });

  it('shows both linked traces when the trace ID arrived late', () => {
    renderSection({
      attributes: [],
      links: [makeLink('server_request'), makeLink('cache_origin')],
    });

    expect(screen.queryByText('Static')).not.toBeInTheDocument();
    expect(screen.getByText('Reused part')).toBeInTheDocument();
    expect(
      screen.getByText('Rendered for this page load, in another trace')
    ).toBeInTheDocument();

    const links = screen.getAllByRole('link', {name: 'Open trace'});
    expect(links).toHaveLength(2);
    const [renderLink, requestLink] = links;
    expect(renderLink).toHaveAttribute(
      'href',
      expect.stringContaining(`/trace/${RENDER_TRACE_ID}/`)
    );
    expect(requestLink).toHaveAttribute(
      'href',
      expect.stringContaining(`/trace/${REQUEST_TRACE_ID}/`)
    );
  });

  it('shows only the server request when its trace ID arrived late', () => {
    renderSection({attributes: [], links: [makeLink('server_request')]});

    expect(screen.getByText('Server request')).toBeInTheDocument();
    expect(screen.getByText('In another trace')).toBeInTheDocument();
    expect(screen.queryByText('Rendered earlier and reused')).not.toBeInTheDocument();
  });
});
