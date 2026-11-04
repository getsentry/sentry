import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {FieldKind} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {AiSpanDashboardLink} from 'sentry/views/insights/pages/agents/components/aiSpanDashboardLink';
import {SpanFields} from 'sentry/views/insights/types';

const organization = OrganizationFixture();

const toolFilter: GlobalFilter = {
  dataset: WidgetType.SPANS,
  tag: {key: 'gen_ai.tool.name', name: 'gen_ai.tool.name', kind: FieldKind.TAG},
  value: 'gen_ai.tool.name:[old-tool]',
};

function mockDashboards() {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/dashboards/`,
    body: [
      DashboardFixture([], {id: '100', prebuiltId: PrebuiltDashboardId.AI_AGENTS_MODELS}),
      DashboardFixture([], {id: '200', prebuiltId: PrebuiltDashboardId.AI_AGENTS_TOOLS}),
    ],
  });
}

describe('AiSpanDashboardLink', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [1, 2], environments: ['production']})
    );
  });

  it.each([
    [SpanFields.GEN_AI_RESPONSE_MODEL, 'gpt-4o', 'View model dashboard', '100'],
    [SpanFields.GEN_AI_REQUEST_MODEL, 'gpt-4', 'View model dashboard', '100'],
    [SpanFields.GEN_AI_TOOL_NAME, 'lookup', 'View tool dashboard', '200'],
  ] as const)(
    'links %s to its organization dashboard',
    async (field, value, label, id) => {
      mockDashboards();
      render(<AiSpanDashboardLink field={field} value={value} />, {organization});

      const link = await screen.findByRole('button', {name: label});
      const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
      expect(url.pathname).toBe(`/organizations/${organization.slug}/dashboard/${id}/`);
      expect(url.searchParams.getAll('project')).toEqual(['1', '2']);
      expect(url.searchParams.getAll('environment')).toEqual(['production']);
      expect(url.searchParams.get('statsPeriod')).toBe('14d');
      expect(JSON.parse(url.searchParams.get('globalFilter')!)).toEqual({
        dataset: WidgetType.SPANS,
        tag: {key: field, name: field, kind: FieldKind.TAG},
        value: `${field}:[${value}]`,
        isTemporary: true,
      });
    }
  );

  it('preserves URL filters and absolute dates, replacing only the clicked field', async () => {
    mockDashboards();
    const modelFilter: GlobalFilter = {
      ...toolFilter,
      tag: {
        key: 'gen_ai.response.model',
        name: 'gen_ai.response.model',
        kind: FieldKind.TAG,
      },
      value: 'gen_ai.response.model:[gpt-4o]',
    };
    render(<AiSpanDashboardLink field={SpanFields.GEN_AI_TOOL_NAME} value="lookup" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/trace-id/',
          query: {
            project: ['3', '4'],
            environment: ['staging', 'production'],
            start: '2026-06-01T00:00:00',
            end: '2026-06-02T00:00:00',
            utc: 'true',
            release: ['1.0', '2.0'],
            globalFilter: [JSON.stringify(toolFilter), JSON.stringify(modelFilter)],
            spanId: 'span-id',
            tab: 'output',
            node: 'node-id',
          },
        },
      },
    });

    const link = await screen.findByRole('button', {name: 'View tool dashboard'});
    const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
    expect(url.searchParams.getAll('project')).toEqual(['3', '4']);
    expect(url.searchParams.getAll('environment')).toEqual(['staging', 'production']);
    expect(url.searchParams.get('start')).toBe('2026-06-01T00:00:00');
    expect(url.searchParams.get('end')).toBe('2026-06-02T00:00:00');
    expect(url.searchParams.get('utc')).toBe('true');
    expect(url.searchParams.getAll('release')).toEqual(['1.0', '2.0']);
    expect(url.searchParams.get('statsPeriod')).toBeNull();
    const filters = url.searchParams
      .getAll('globalFilter')
      .map(filter => JSON.parse(filter));
    expect(filters).toEqual([
      modelFilter,
      {...toolFilter, value: 'gen_ai.tool.name:[lookup]', isTemporary: true},
    ]);
    expect(url.searchParams.has('spanId')).toBe(false);
    expect(url.searchParams.has('tab')).toBe(false);
    expect(url.searchParams.has('node')).toBe(false);
  });

  it('escapes special characters in names', async () => {
    mockDashboards();
    render(
      <AiSpanDashboardLink
        field={SpanFields.GEN_AI_TOOL_NAME}
        value='lookup "customer"'
      />,
      {organization}
    );

    const link = await screen.findByRole('button', {name: 'View tool dashboard'});
    const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
    expect(JSON.parse(url.searchParams.get('globalFilter')!).value).toBe(
      'gen_ai.tool.name:["lookup \\"customer\\""]'
    );
  });

  it('preserves the all-projects selection and ignores malformed global filters', async () => {
    mockDashboards();
    render(<AiSpanDashboardLink field={SpanFields.GEN_AI_TOOL_NAME} value="lookup" />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/', query: {project: '-1', globalFilter: 'invalid'}},
      },
    });

    const link = await screen.findByRole('button', {name: 'View tool dashboard'});
    const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
    expect(url.searchParams.getAll('project')).toEqual(['-1']);
    expect(url.searchParams.getAll('globalFilter')).toHaveLength(1);
  });

  it('updates the destination when a different span is selected', async () => {
    const request = mockDashboards();
    const {rerender} = render(
      <AiSpanDashboardLink field={SpanFields.GEN_AI_TOOL_NAME} value="lookup" />,
      {organization}
    );
    await screen.findByRole('button', {name: 'View tool dashboard'});

    rerender(
      <AiSpanDashboardLink field={SpanFields.GEN_AI_TOOL_NAME} value="calculate" />
    );
    const link = screen.getByRole('button', {name: 'View tool dashboard'});
    const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
    expect(JSON.parse(url.searchParams.get('globalFilter')!).value).toBe(
      'gen_ai.tool.name:[calculate]'
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([200, 403])(
    'does not show a link when the dashboard is unavailable (%s)',
    async statusCode => {
      const request = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/dashboards/`,
        body: [],
        statusCode,
      });
      render(<AiSpanDashboardLink field={SpanFields.GEN_AI_TOOL_NAME} value="lookup" />, {
        organization,
      });

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      await waitFor(() => expect(request).toHaveBeenCalled());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    }
  );
});
