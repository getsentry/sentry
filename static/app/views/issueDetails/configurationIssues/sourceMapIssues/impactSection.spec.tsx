import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ImpactSection} from './impactSection';

const REFERRER_EVENTS_COUNT = 'api.issues.sourcemap-configuration.impact-events-count';
const REFERRER_RELEASES = 'api.issues.sourcemap-configuration.impact-releases';
const REFERRER_SAMPLES = 'api.issues.sourcemap-configuration.impact-samples';

describe('ImpactSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const eventsUrl = `/organizations/${organization.slug}/events/`;

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({referrer: REFERRER_EVENTS_COUNT})],
      body: {data: [{'count_unique(event_id)': 0}]},
    });
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({referrer: REFERRER_RELEASES})],
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({referrer: REFERRER_SAMPLES})],
      body: {data: []},
    });
  });

  describe('EventsCount', () => {
    it('renders the event count', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_EVENTS_COUNT})],
        body: {data: [{'count_unique(event_id)': 17}]},
      });

      render(<ImpactSection project={project} />, {organization});

      expect(screen.getByText('Impact')).toBeInTheDocument();
      expect(
        await screen.findByText(
          '17 events with unreadable stack traces in the last 30 days'
        )
      ).toBeInTheDocument();
    });

    it('renders empty state when count is zero', async () => {
      render(<ImpactSection project={project} />, {organization});

      expect(
        await screen.findByText('No impacted events found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('renders error state when the request fails', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_EVENTS_COUNT})],
        statusCode: 500,
        body: {},
      });

      render(<ImpactSection project={project} />, {organization});

      expect(
        await screen.findByText('Unable to load impacted events count.')
      ).toBeInTheDocument();
    });
  });

  describe('AffectedReleases', () => {
    it('renders releases with event counts', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_RELEASES})],
        body: {
          data: [
            {release: 'v2.4.1', 'count_unique(event_id)': 8},
            {release: 'v2.3.0', 'count_unique(event_id)': 3},
          ],
        },
      });

      render(<ImpactSection project={project} />, {organization});

      expect(await screen.findByText('v2.4.1')).toBeInTheDocument();
      expect(screen.getByText('8 events')).toBeInTheDocument();
      expect(screen.getByText('v2.3.0')).toBeInTheDocument();
      expect(screen.getByText('3 events')).toBeInTheDocument();
    });

    it('renders empty state when there are no releases', async () => {
      render(<ImpactSection project={project} />, {organization});

      expect(
        await screen.findByText('No affected releases found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('renders error state when the request fails', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_RELEASES})],
        statusCode: 500,
        body: {},
      });

      render(<ImpactSection project={project} />, {organization});

      expect(
        await screen.findByText('Unable to load affected releases.')
      ).toBeInTheDocument();
    });
  });

  describe('SampleEvents', () => {
    it('renders sample events with links to issue details', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_SAMPLES})],
        body: {
          data: [
            {
              title: 'TypeError: Cannot read property',
              event_id: 'abc123',
              group_id: 'group456',
              timestamp: '2024-01-15T10:00:00.000Z',
            },
          ],
        },
      });

      render(<ImpactSection project={project} />, {organization});

      const link = await screen.findByText('TypeError: Cannot read property');
      expect(link).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/issues/group456/events/abc123/`
      );
    });

    it('renders title as muted text when group_id is null', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_SAMPLES})],
        body: {
          data: [
            {
              title: 'TypeError: Cannot read property',
              event_id: 'abc123',
              group_id: null,
              timestamp: '2024-01-15T10:00:00.000Z',
            },
          ],
        },
      });

      render(<ImpactSection project={project} />, {organization});

      await screen.findByText('TypeError: Cannot read property');
      expect(
        screen.queryByRole('link', {name: 'TypeError: Cannot read property'})
      ).not.toBeInTheDocument();
    });

    it('renders empty state when there are no sample events', async () => {
      render(<ImpactSection project={project} />, {organization});

      expect(
        await screen.findByText('No sample events found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('renders error state when the request fails', async () => {
      MockApiClient.addMockResponse({
        url: eventsUrl,
        match: [MockApiClient.matchQuery({referrer: REFERRER_SAMPLES})],
        statusCode: 500,
        body: {},
      });

      render(<ImpactSection project={project} />, {organization});

      expect(
        await screen.findByText('Unable to load sample events.')
      ).toBeInTheDocument();
    });
  });
});
