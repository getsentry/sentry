import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {
  TracePinnedAttributeColumn,
  TracePinnedAttributeHeader,
  useTracePinnedAttribute,
} from 'sentry/views/performance/newTraceDetails/tracePinnedAttribute';

function makeNode(additional_attributes?: Record<string, string | number>) {
  return new EapSpanNode(null, makeEAPSpan({additional_attributes}), {
    organization: OrganizationFixture(),
  });
}

describe('useTracePinnedAttribute', () => {
  it('reads the pinned attribute from the URL', () => {
    const {result} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {
        location: {pathname: '/trace/', query: {pinnedAttribute: 'span.duration'}},
      },
    });

    expect(result.current.pinnedAttribute).toBe('span.duration');
  });

  it('returns null when nothing is pinned', () => {
    const {result} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {location: {pathname: '/trace/'}},
    });

    expect(result.current.pinnedAttribute).toBeNull();
  });

  it('sets the pinned attribute in the URL, preserving other params', async () => {
    const {result, router} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {location: {pathname: '/trace/', query: {foo: 'bar'}}},
    });

    act(() => result.current.setPinnedAttribute('span.op'));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBe('span.op');
    });
    expect(router.location.query.foo).toBe('bar');
  });

  it('clears the pinned attribute from the URL, preserving other params', async () => {
    const {result, router} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {
        location: {
          pathname: '/trace/',
          query: {pinnedAttribute: 'span.op', foo: 'bar'},
        },
      },
    });

    act(() => result.current.setPinnedAttribute(null));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBeUndefined();
    });
    expect(router.location.query.foo).toBe('bar');
  });
});

describe('TracePinnedAttributeColumn', () => {
  it('renders the attribute value for the node', () => {
    const node = makeNode({'http.response.status_code': 200});

    render(
      <TracePinnedAttributeColumn
        node={node}
        pinnedAttribute="http.response.status_code"
      />
    );

    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders a placeholder when the node has no value for the attribute', () => {
    const node = makeNode();

    render(
      <TracePinnedAttributeColumn
        node={node}
        pinnedAttribute="http.response.status_code"
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('TracePinnedAttributeHeader', () => {
  it('renders the prettified attribute name', () => {
    render(<TracePinnedAttributeHeader pinnedAttribute="http.response.status_code" />, {
      initialRouterConfig: {
        location: {
          pathname: '/trace/',
          query: {pinnedAttribute: 'http.response.status_code'},
        },
      },
    });

    expect(
      screen.getByText(prettifyAttributeName('http.response.status_code'))
    ).toBeInTheDocument();
  });

  it('unpins the attribute when the remove button is clicked', async () => {
    const {router} = render(<TracePinnedAttributeHeader pinnedAttribute="span.op" />, {
      initialRouterConfig: {
        location: {pathname: '/trace/', query: {pinnedAttribute: 'span.op'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Remove pinned column'}));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBeUndefined();
    });
  });
});
