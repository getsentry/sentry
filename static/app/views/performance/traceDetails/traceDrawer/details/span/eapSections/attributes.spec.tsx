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

  it.each([false, true])(
    'preserves links and timestamp cards (raw names: %s)',
    async useRawAttributeNames => {
      const testOrganization = OrganizationFixture({
        features: useRawAttributeNames ? ['trace-item-details-raw-attribute-names'] : [],
      });
      const profileId = '0123456789abcdef0123456789abcdef';
      const replayId = 'fedcba9876543210fedcba9876543210';
      const traceId = '11111111111111111111111111111111';
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
                name: useRawAttributeNames ? 'sentry.profile_id' : 'profile.id',
                type: 'str',
                value: profileId,
              },
              {
                name: useRawAttributeNames ? 'sentry.replay_id' : 'replayId',
                type: 'str',
                value: replayId,
              },
              {
                name: useRawAttributeNames ? 'sentry.trace_id' : 'trace',
                type: 'str',
                value: traceId,
              },
              {
                name: useRawAttributeNames
                  ? 'sentry.start_timestamp_precise'
                  : 'precise.start_ts',
                type: 'float',
                value: 1740787200.123,
              },
              {
                name: useRawAttributeNames
                  ? 'sentry.end_timestamp_precise'
                  : 'precise.finish_ts',
                type: 'float',
                value: 1740787201.123,
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
      expect(screen.getByRole('link', {name: profileId})).toHaveAttribute(
        'href',
        expect.stringContaining(profileId)
      );
      expect(screen.getByRole('link', {name: replayId})).toHaveAttribute(
        'href',
        expect.stringContaining(replayId)
      );
      expect(screen.getByRole('link', {name: traceId})).toHaveAttribute(
        'href',
        expect.stringContaining(traceId)
      );
      await userEvent.hover(screen.getByText('1740787200.123'));
      expect(await screen.findByText('Timestamp')).toBeInTheDocument();
      await userEvent.unhover(screen.getByText('1740787200.123'));
      await userEvent.hover(screen.getByText('1740787201.123'));
      expect(await screen.findByText('Timestamp')).toBeInTheDocument();
    }
  );

  it('falls back to the raw value when the timestamp is not a number', () => {
    renderAttributes([{name: 'precise.start_ts', type: 'str', value: 'not-a-number'}]);

    expect(screen.getByText('not-a-number')).toBeInTheDocument();
    expect(screen.queryByText(/UTC/)).not.toBeInTheDocument();
  });
});
