import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanOpSelector} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';

jest.mock('sentry/utils/usePageFilters');

describe('SpanOpSelector', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [parseInt(project.id, 10)],
      },
    })
  );

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    body: {
      meta: {
        fields: {
          'span.op': 'string',
          'count()': 'integer',
        },
      },
      data: [
        {
          'span.op': 'app.start.cold',
          'count()': 1,
        },
        {
          'span.op': 'app.start.warm',
          'count()': 2,
        },
        {
          'span.op': 'contentprovider.load',
          'count()': 3,
        },
      ],
    },
  });

  it('lists all span operations that are stored', async () => {
    render(<SpanOpSelector primaryRelease="release1" transaction="foo-bar" />);

    expect(await screen.findByText('All')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All'));

    // These options appear because the events request says we have spans stored
    expect(
      await screen.findByRole('option', {name: 'app.start.cold'})
    ).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'app.start.warm'})).toBeInTheDocument();
    expect(
      screen.getByRole('option', {name: 'contentprovider.load'})
    ).toBeInTheDocument();
  });
});
