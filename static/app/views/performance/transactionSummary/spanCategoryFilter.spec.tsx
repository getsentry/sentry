import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SpanCategoryFilter} from './spanCategoryFilter';

describe('SpanCategoryFilter', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {'span.category': 'db', 'count()': 10},
          {'span.category': 'http', 'count()': 5},
        ],
      },
    });
  });

  it('pushes the selected category onto the URL when a category is chosen', async () => {
    const {router} = render(<SpanCategoryFilter segmentSpanName="/api/" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/insights/summary/',
          query: {transaction: '/api/'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Filter by category'}));
    await userEvent.click(await screen.findByRole('option', {name: 'db'}));

    await waitFor(() => expect(router.location.query['span.category']).toBe('db'));
    expect(router.location.query.transaction).toBe('/api/');
    expect(router.historyAction).toBe('PUSH');
  });

  it('reads the selected category from the URL when one is set', async () => {
    render(<SpanCategoryFilter segmentSpanName="/api/" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/insights/summary/',
          query: {'span.category': 'http'},
        },
      },
    });

    expect(
      await screen.findByRole('button', {name: 'Filter by category'})
    ).toHaveTextContent('http');
  });
});
