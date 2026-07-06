import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {AttributesContent} from './attributes';

describe('AttributesContent pin action', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const theme = ThemeFixture();
  const location = LocationFixture();

  const attributes: TraceItemResponseAttribute[] = [
    {name: 'environment', type: 'str', value: 'production'},
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function renderContent(query: Record<string, string> = {}) {
    const node = new EapSpanNode(null, makeEAPSpan({}), {organization});

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
      </TraceStateProvider>,
      {
        organization,
        initialRouterConfig: {location: {pathname: '/trace/', query}},
      }
    );
  }

  async function openAttributeMenu() {
    const row = (await screen.findAllByTestId('attribute-tree-row'))[0]!;
    await userEvent.hover(row);
    await userEvent.click(
      within(row).getByRole('button', {name: 'Attribute Actions Menu'})
    );
  }

  it('pins the attribute as a column from the actions menu', async () => {
    const {router} = renderContent();

    await openAttributeMenu();
    await userEvent.click(await screen.findByText('Pin as column'));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBe('environment');
    });
  });

  it('shows "Unpin column" when the attribute is already pinned', async () => {
    renderContent({pinnedAttribute: 'environment'});

    await openAttributeMenu();

    expect(await screen.findByText('Unpin column')).toBeInTheDocument();
    expect(screen.queryByText('Pin as column')).not.toBeInTheDocument();
  });

  it('unpins the attribute when "Unpin column" is clicked', async () => {
    const {router} = renderContent({pinnedAttribute: 'environment'});

    await openAttributeMenu();
    await userEvent.click(await screen.findByText('Unpin column'));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBeUndefined();
    });
  });

  it('shows a pin indicator on the pinned attribute row', async () => {
    renderContent({pinnedAttribute: 'environment'});

    expect(await screen.findByTestId('pinned-attribute-indicator')).toBeInTheDocument();
  });

  it('does not show a pin indicator when nothing is pinned', async () => {
    renderContent();

    expect(await screen.findByText('production')).toBeInTheDocument();
    expect(screen.queryByTestId('pinned-attribute-indicator')).not.toBeInTheDocument();
  });
});
