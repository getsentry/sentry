import {SEARCH_PAGE__SERVER_RENDERING__TYPE} from '@sentry/conventions/attributes/search';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {isServerRenderNode} from 'sentry/views/performance/traceDetails/traceGuards';

import {TraceTree} from './traceTree';
import {makeEAPSpan, makeEAPTrace} from './traceTreeTestUtils';

const organization = OrganizationFixture({
  features: ['performance-trace-cache-lifecycle'],
});
const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;

function makeDocumentRequest() {
  return makeEAPSpan({
    event_id: 'document',
    op: 'browser.request',
    description: 'https://example.com/docs/getting-started',
    start_timestamp: start + 0.1,
    end_timestamp: start + 0.2,
  });
}

function makePageload(
  type: string | undefined,
  children = [
    makeDocumentRequest(),
    makeEAPSpan({
      event_id: 'paint',
      op: 'browser.paint',
      start_timestamp: start + 0.3,
      end_timestamp: start + 0.3,
    }),
  ]
) {
  return makeEAPSpan({
    event_id: 'pageload',
    op: 'pageload',
    start_timestamp: start,
    end_timestamp: start + 2,
    is_transaction: true,
    additional_attributes: type
      ? {[SEARCH_PAGE__SERVER_RENDERING__TYPE]: type}
      : undefined,
    children,
  });
}

function buildTree(pageload: ReturnType<typeof makePageload>, org = organization) {
  return TraceTree.FromTrace(makeEAPTrace([pageload]), {replay: null, organization: org});
}

function getPageload(tree: TraceTree) {
  return tree.root.findChild(node => node.id === 'pageload')!;
}

function getDocumentRequest(tree: TraceTree) {
  return tree.root.findChild(node => node.id === 'document')!;
}

describe('server rendering placeholders', () => {
  it('covers the document request with the part of the page that was reused', () => {
    const tree = buildTree(makePageload('static'));

    const placeholder = tree.root.findChild(isServerRenderNode);

    expect(placeholder?.value).toEqual({
      type: 'server_render_placeholder',
      part: 'whole_page',
      start_timestamp: start + 0.1,
      end_timestamp: start + 0.2,
    });
    expect(placeholder?.space).toEqual([(start + 0.1) * 1e3, expect.closeTo(100, 2)]);
  });

  it('puts the placeholder first under the document request', () => {
    const tree = buildTree(makePageload('partially_static'));

    const documentRequest = getDocumentRequest(tree);
    const placeholder = tree.root.findChild(isServerRenderNode);

    expect(documentRequest.children).toEqual([placeholder]);
    expect(placeholder?.parent).toBe(documentRequest);
  });

  it('puts the placeholder first under the pageload when it has no document request', () => {
    const tree = buildTree(
      makePageload('static', [
        makeEAPSpan({
          event_id: 'paint',
          op: 'browser.paint',
          start_timestamp: start + 0.3,
        }),
      ])
    );

    const pageload = getPageload(tree);

    expect(pageload.children[0]).toBe(tree.root.findChild(isServerRenderNode));
    expect(pageload.children[0]?.space).toEqual([start * 1e3, 0]);
  });

  it('shows the placeholder while the pageload shows only its transactions', () => {
    const tree = buildTree(makePageload('static'));

    const serialized = tree.build().serialize();

    expect(serialized).toMatchInlineSnapshot(`
"
eap trace root
  pageload - span.description (eap-transaction)
    server render placeholder - whole_page
"
`);
  });

  it('shows the placeholder under the document request when the pageload is expanded', () => {
    const tree = buildTree(makePageload('partially_static'));

    getPageload(tree).expand(true, tree);

    expect(tree.build().serialize()).toMatchInlineSnapshot(`
"
eap trace root
  pageload - span.description (eap-transaction)
    browser.request - https://example.com/docs/getting-started
      server render placeholder - static_part
    browser.paint - span.description
"
`);
  });

  it('keeps the placeholder before the server request of a partially static page', () => {
    const serverRequest = makeEAPSpan({
      event_id: 'server',
      op: 'http.server',
      description: 'GET /docs/getting-started',
      start_timestamp: start + 0.12,
      end_timestamp: start + 0.18,
      is_transaction: true,
      children: [makePageload('partially_static')],
    });
    const tree = TraceTree.FromTrace(makeEAPTrace([serverRequest]), {
      replay: null,
      organization,
    });

    getPageload(tree).expand(true, tree);

    expect(getDocumentRequest(tree).children.map(child => child.id)).toEqual([
      'pageload-server-render',
      'server',
    ]);
  });

  it.each([
    ['without a type', undefined],
    ['with a type that SDKs do not set', 'dynamic'],
  ])('adds no placeholder for a pageload %s', (_label, type) => {
    const tree = buildTree(makePageload(type));

    expect(tree.root.findChild(isServerRenderNode)).toBeNull();
  });

  it('adds no placeholder without the feature', () => {
    const tree = buildTree(makePageload('static'), OrganizationFixture());

    expect(tree.root.findChild(isServerRenderNode)).toBeNull();
  });
});
