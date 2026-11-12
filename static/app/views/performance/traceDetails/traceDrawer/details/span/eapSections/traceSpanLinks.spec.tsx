import {SEARCH_SENTRY__LINK__TYPE} from '@sentry/conventions/attributes/search';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TraceItemResponseLink} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

import {TraceSpanLinks} from './traceSpanLinks';

const TRACE_ID = '7b059916d0f54ac4a4c8e0b1f2d3a4b5';

describe('TraceSpanLinks', () => {
  const organization = OrganizationFixture();
  const location = LocationFixture();
  const theme = ThemeFixture();
  const node = new EapSpanNode(null, makeEAPSpan({event_id: 'span-id'}), {organization});

  beforeEach(() => {
    // The section saves its collapse state.
    localStorage.clear();
  });

  function makeLink(
    spanId: string,
    {linkType, sampled}: {linkType?: string; sampled?: boolean} = {}
  ): TraceItemResponseLink {
    return {
      itemId: spanId,
      // The trace id starts with zeros, so its short form differs from the span id.
      traceId: `0000${spanId}000000000000`,
      sampled,
      attributes: linkType
        ? [{name: SEARCH_SENTRY__LINK__TYPE, type: 'str', value: linkType}]
        : undefined,
    };
  }

  async function renderLinks(links: TraceItemResponseLink[]) {
    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <TraceSpanLinks
          links={links}
          location={location}
          node={node}
          onTabScrollToNode={jest.fn()}
          organization={organization}
          theme={theme}
          traceId={TRACE_ID}
        />
      </TraceStateProvider>
    );
    // The section is collapsed by default.
    await userEvent.click(screen.getByRole('button', {name: 'View Section'}));
  }

  it('gives each link its own group, named after its link type', async () => {
    await renderLinks([
      makeLink('aaaaaaaaaaaaaaaa', {linkType: 'previous_trace'}),
      makeLink('bbbbbbbbbbbbbbbb', {linkType: 'cache_origin'}),
      makeLink('cccccccccccccccc'),
      makeLink('dddddddddddddddd', {linkType: 'cache_origin'}),
    ]);

    // Group names and short span ids, in the order they render. A repeated
    // link type gets a counter, so the tree does not merge the two groups.
    const groupNamesAndSpanIds = screen
      .getAllByText(/^(previous_trace|cache_origin( \(\d\))?|link|[a-d]{8})$/)
      .map(element => element.textContent);
    expect(groupNamesAndSpanIds).toEqual([
      'previous_trace',
      'aaaaaaaa',
      'cache_origin (1)',
      'bbbbbbbb',
      'link',
      'cccccccc',
      'cache_origin (2)',
      'dddddddd',
    ]);
  });

  it('shows the sampled row when a link is not sampled', async () => {
    await renderLinks([makeLink('aaaaaaaaaaaaaaaa', {sampled: false})]);

    expect(screen.getByText('sampled')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});
