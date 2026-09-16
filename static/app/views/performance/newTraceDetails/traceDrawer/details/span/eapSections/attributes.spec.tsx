import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

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

  it('falls back to the raw value when the timestamp is not a number', () => {
    renderAttributes([{name: 'precise.start_ts', type: 'str', value: 'not-a-number'}]);

    expect(screen.getByText('not-a-number')).toBeInTheDocument();
    expect(screen.queryByText(/UTC/)).not.toBeInTheDocument();
  });
});
