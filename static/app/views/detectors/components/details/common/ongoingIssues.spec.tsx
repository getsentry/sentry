import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {getUtcDateString} from 'sentry/utils/dates';

import {DetectorDetailsOngoingIssues} from './ongoingIssues';

describe('DetectorDetailsOngoingIssues', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
  });

  it('renders issue list and view all link with default statsPeriod', async () => {
    const detector = UptimeDetectorFixture({id: '1'});
    const group = GroupFixture();

    const issuesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'GET',
      body: [group],
    });

    render(
      <DetectorDetailsOngoingIssues detector={detector} dateTimeSelection={null} />,
      {organization}
    );

    await waitFor(() =>
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            query: `is:unresolved detector:${detector.id}`,
            project: detector.projectId,
            statsPeriod: '90d',
            limit: 5,
          }),
        })
      )
    );

    const viewAll = screen.getByTestId('view-all-ongoing-issues-button');
    expect(viewAll).toBeInTheDocument();
    expect(viewAll).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/?project=${detector.projectId}&query=is%3Aunresolved%20detector%3A${detector.id}&statsPeriod=90d`
    );
  });

  it('renders issue list and view all link with datetime selection', async () => {
    const detector = UptimeDetectorFixture({id: '2'});
    const group = GroupFixture();

    const start = '2026-02-01T00:00:00';
    const end = '2026-02-02T00:00:00';

    const issuesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'GET',
      body: [group],
    });

    render(
      <DetectorDetailsOngoingIssues
        detector={detector}
        dateTimeSelection={{start, end, period: null, utc: null}}
      />,
      {organization}
    );

    await waitFor(() =>
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            query: `is:unresolved detector:${detector.id}`,
            project: detector.projectId,
            start: getUtcDateString(start),
            end: getUtcDateString(end),
            limit: 5,
          }),
        })
      )
    );

    const viewAll = screen.getByTestId('view-all-ongoing-issues-button');
    expect(viewAll).toBeInTheDocument();
    expect(viewAll).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/?end=${encodeURIComponent(end)}&project=${detector.projectId}&query=is%3Aunresolved%20detector%3A${detector.id}&start=${encodeURIComponent(start)}`
    );
  });
});
