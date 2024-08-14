import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DatabaseSystemSelector} from 'sentry/views/insights/database/components/databaseSystemSelector';

jest.mock('sentry/views/insights/common/queries/useDiscover', () => ({
  useSpanMetrics: () => ({
    data: [
      {
        'span.system': 'postgresql',
        'count()': 1000,
      },
      {
        'span.system': 'mongodb',
        'count()': 500,
      },
      {
        'span.system': 'chungusdb',
        'count()': 200,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

describe('DatabaseSystemSelector', function () {
  const organization = OrganizationFixture();

  beforeEach(function () {});

  afterAll(() => {
    jest.clearAllMocks();
  });

  it('renders properly', async function () {
    render(<DatabaseSystemSelector />, {organization});

    const dropdownSelector = await screen.findByRole('button');
    expect(dropdownSelector).toBeEnabled();

    screen.debug();
  });
});
