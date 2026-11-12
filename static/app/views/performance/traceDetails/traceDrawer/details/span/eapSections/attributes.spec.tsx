import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

import {AttributesContent} from './attributes';

describe('AttributesContent', () => {
  const organization = OrganizationFixture();
  const location = LocationFixture();
  const theme = ThemeFixture();
  const project = ProjectFixture({id: '1', slug: 'project_slug'});

  function renderAttributes(attributes: TraceItemResponseAttribute[]) {
    const node = new EapSpanNode(
      null,
      makeEAPSpan({event_id: 'span-id', project_id: 1, project_slug: 'project_slug'}),
      {organization}
    );

    return render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <AttributesContent
          node={node}
          attributes={attributes}
          theme={theme}
          location={location}
          organization={organization}
          project={project}
        />
      </TraceStateProvider>
    );
  }

  it.each(['precise.start_ts', 'precise.finish_ts'])(
    'keeps the raw %s value visible with a human-readable card on hover',
    name => {
      // 2025-03-01T00:00:00.123Z as a Unix timestamp in seconds (float)
      renderAttributes([{name, type: 'float', value: 1740787200.123}]);

      expect(screen.getByText('1740787200.123')).toBeInTheDocument();
      expect(screen.queryByText(/UTC/)).not.toBeInTheDocument();
    }
  );

  it.each([
    {features: [], search: 'span.op'},
    {features: ['trace-item-details-raw-attribute-names'], search: 'sentry.op'},
    {features: ['trace-item-details-raw-attribute-names'], search: 'span.op'},
    {features: ['trace-item-details-raw-attribute-names'], search: ' SPAN.OP '},
  ])(
    'searches attribute names for $search with $features',
    async ({features, search}) => {
      const testOrganization = OrganizationFixture({features});
      const node = new EapSpanNode(
        null,
        makeEAPSpan({event_id: 'span-id', project_id: 1}),
        {organization: testOrganization}
      );
      render(
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <AttributesContent
            node={node}
            attributes={[
              {name: 'span.op', rawName: 'sentry.op', type: 'str', value: 'http.server'},
              {name: 'custom', rawName: 'custom', type: 'str', value: 'other value'},
            ]}
            theme={theme}
            location={location}
            organization={testOrganization}
            project={project}
          />
        </TraceStateProvider>,
        {organization: testOrganization}
      );

      await userEvent.type(screen.getByRole('textbox'), search);

      expect(screen.getByText('http.server')).toBeInTheDocument();
      expect(screen.queryByText('other value')).not.toBeInTheDocument();
    }
  );

  it.each([false, true])(
    'prioritizes sentry raw names or span aliases (raw names: %s)',
    useRawAttributeNames => {
      const testOrganization = OrganizationFixture({
        features: useRawAttributeNames ? ['trace-item-details-raw-attribute-names'] : [],
      });
      const node = new EapSpanNode(
        null,
        makeEAPSpan({event_id: 'span-id', project_id: 1}),
        {organization: testOrganization}
      );
      render(
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <AttributesContent
            node={node}
            attributes={[
              {
                name: 'span.op',
                rawName: 'sentry.op',
                type: 'str',
                value: 'operation value',
              },
              {
                name: 'span.duration',
                rawName: 'sentry.duration_ms',
                type: 'int',
                value: 42,
              },
              {name: 'middle', type: 'str', value: 'fallback value'},
              {
                name: 'tags[aaa.custom,string]',
                rawName: 'aaa.custom',
                type: 'str',
                value: 'custom value',
              },
            ]}
            theme={theme}
            location={location}
            organization={testOrganization}
            project={project}
          />
        </TraceStateProvider>,
        {organization: testOrganization}
      );

      expect(
        screen
          .getAllByText(/^(operation value|42|fallback value|custom value)$/)
          .map(element => element.textContent)
      ).toEqual(
        useRawAttributeNames
          ? ['42', 'operation value', 'custom value', 'fallback value']
          : ['42', 'operation value', 'fallback value', 'custom value']
      );
    }
  );

  it('falls back to the raw value when the timestamp is not a number', () => {
    renderAttributes([{name: 'precise.start_ts', type: 'str', value: 'not-a-number'}]);

    expect(screen.getByText('not-a-number')).toBeInTheDocument();
    expect(screen.queryByText(/UTC/)).not.toBeInTheDocument();
  });
});
