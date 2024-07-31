import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanOpSelector} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';

jest.mock('sentry/utils/usePageFilters');

describe('SpanOpSelector', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
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
  });

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

  it('lists all span operations that are stored', async function () {
    render(
      <SpanOpSelector
        primaryRelease="release1"
        secondaryRelease="release2"
        transaction="foo-bar"
      />
    );

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
