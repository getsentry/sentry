import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

const organization = OrganizationFixture();

function renderWithQuery(query: Record<string, string | string[]>) {
  return render(<SpansQueryParamsProvider>{null}</SpansQueryParamsProvider>, {
    organization,
    initialRouterConfig: {
      route: '/organizations/:orgId/explore/traces/',
      location: {
        pathname: `/organizations/${organization.slug}/explore/traces/`,
        query,
      },
    },
  });
}

describe('SpansQueryParamsProvider', () => {
  it('drops aggregateSort that does not reference any active yAxis or groupBy', async () => {
    const {router} = renderWithQuery({
      aggregateField: [
        JSON.stringify({groupBy: 'gen_ai.tool.name'}),
        JSON.stringify({yAxes: ['count(span.duration)'], chartType: 0}),
      ],
      aggregateSort: '-count_unique(user.id)',
    });

    await waitFor(() => {
      expect(router.location.query.aggregateSort).toBeUndefined();
    });
    expect(router.location.query.aggregateField).toEqual([
      JSON.stringify({groupBy: 'gen_ai.tool.name'}),
      JSON.stringify({yAxes: ['count(span.duration)'], chartType: 0}),
    ]);
  });

  it('keeps aggregateSort when every entry references an active yAxis', async () => {
    const {router} = renderWithQuery({
      aggregateField: [
        JSON.stringify({groupBy: 'gen_ai.tool.name'}),
        JSON.stringify({yAxes: ['count(span.duration)']}),
      ],
      aggregateSort: '-count(span.duration)',
    });

    // Give the effect a tick to fire — if it triggers a navigate, the test
    // will see the change. Otherwise the URL should be untouched.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(router.location.query.aggregateSort).toBe('-count(span.duration)');
  });

  it('keeps aggregateSort when every entry references an active groupBy', async () => {
    const {router} = renderWithQuery({
      aggregateField: [
        JSON.stringify({groupBy: 'gen_ai.tool.name'}),
        JSON.stringify({yAxes: ['count(span.duration)']}),
      ],
      aggregateSort: 'gen_ai.tool.name',
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(router.location.query.aggregateSort).toBe('gen_ai.tool.name');
  });

  it('drops legacy visualize and groupBy keys when aggregateField is present', async () => {
    const {router} = renderWithQuery({
      aggregateField: JSON.stringify({yAxes: ['count(span.duration)']}),
      visualize: JSON.stringify({yAxes: ['count_unique(user.id)']}),
      groupBy: 'gen_ai.tool.name',
    });

    await waitFor(() => {
      expect(router.location.query.visualize).toBeUndefined();
      expect(router.location.query.groupBy).toBeUndefined();
    });
    expect(router.location.query.aggregateField).toBe(
      JSON.stringify({yAxes: ['count(span.duration)']})
    );
  });

  it('does not navigate when URL is already canonical', async () => {
    const {router} = renderWithQuery({
      aggregateField: JSON.stringify({yAxes: ['count(span.duration)']}),
      project: '1',
    });

    const initialPathname = router.location.pathname;
    const initialQuery = {...router.location.query};

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(router.location.pathname).toBe(initialPathname);
    expect(router.location.query).toEqual(initialQuery);
  });
});
