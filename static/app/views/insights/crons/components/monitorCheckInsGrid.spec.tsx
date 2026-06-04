import {CheckInFixture} from 'sentry-fixture/checkIn';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {CheckInStatus} from 'sentry/views/insights/crons/types';

import {MonitorCheckInsGrid} from './monitorCheckInsGrid';

describe('CheckInRow', () => {
  const project = ProjectFixture();

  it('represents a simple Missed check-in', () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.MISSED,
      duration: null,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2025 12:00:00 AM UTC')).toBeInTheDocument();
  });

  it('represents a simple Okay check-in', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.OK,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    expect(screen.getByText('Okay')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2025 12:00:01 AM UTC')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2025 12:00:10 AM UTC')).toBeInTheDocument();
    expect(screen.getByText('9 seconds')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2025 12:00:00 AM UTC')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('9 seconds'));
    expect(await screen.findByText('9 seconds 50 milliseconds')).toBeInTheDocument();
  });

  it('represents an In Progress check-in', () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.IN_PROGRESS,
      dateAdded: '2025-01-01T00:00:01Z',
      dateUpdated: '2025-01-01T00:00:01Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: null,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    expect(screen.getAllByText('In Progress')).toHaveLength(2);
  });

  it('shows environments when hasMultiEnv', () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.OK,
      environment: 'prod',
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} hasMultiEnv />);

    expect(screen.getByText('prod')).toBeInTheDocument();
  });

  it('represents a check-in without a in-progress', async () => {
    const checkIn = CheckInFixture({
      dateAdded: '2025-01-01T00:00:10Z',
      dateUpdated: '2025-01-01T00:00:10Z',
      dateInProgress: null,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    const notSent = screen.getByText('Not Sent');
    expect(notSent).toBeInTheDocument();
    await userEvent.hover(notSent);

    const expectedTooltip = /No in-progress check-in was received/;

    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('represents a timed-out incomplete check-in', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.TIMEOUT,
      dateAdded: '2025-01-01T00:00:01Z',
      dateUpdated: '2025-01-01T00:00:01Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: null,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    const incomplete = screen.getByText('Incomplete');
    expect(incomplete).toBeInTheDocument();
    await userEvent.hover(incomplete);

    const expectedTooltip =
      /An in-progress check-in was received, but no closing check-in followed/;

    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('represents a timed-out check-in with a late terminal check-in', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.TIMEOUT,
      dateAdded: '2025-01-01T00:00:01Z',
      dateUpdated: '2025-01-01T00:12:00Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: 12 * 60 * 1000,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    const overrunBadge = screen.getByText(textWithMarkupMatcher('2min late'));
    expect(overrunBadge).toBeInTheDocument();
    await userEvent.hover(overrunBadge);

    const expectedTooltip = textWithMarkupMatcher(
      'The closing check-in occurred 2 minutes after this check-in was marked as timed out. The configured maximum allowed runtime is 10 minutes.'
    );

    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('represents a early check-in', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.OK,
      dateAdded: '2025-01-01T00:00:01Z',
      dateUpdated: '2025-01-01T00:00:10Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      expectedTime: '2025-01-02T00:00:00Z',
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    const earlyBadge = screen.getByText(textWithMarkupMatcher('Early'));
    expect(earlyBadge).toBeInTheDocument();
    await userEvent.hover(earlyBadge);

    const expectedTooltip = textWithMarkupMatcher(
      'This check-in was recorded 24 hours earlier than expected, which may indicate a configuration issue.'
    );

    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('represents a early check-in that is likely due to a missing in-progress', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.OK,
      dateAdded: '2025-01-01T00:12:00Z',
      dateUpdated: '2025-01-01T00:12:00',
      dateInProgress: null,
      expectedTime: '2025-01-02T00:00:00Z',
      duration: 12 * 60 * 1000,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    const earlyBadge = screen.getByText(textWithMarkupMatcher('Early'));
    expect(earlyBadge).toBeInTheDocument();
    await userEvent.hover(earlyBadge);

    const expectedTooltip = textWithMarkupMatcher(
      'This check-in was recorded 24 hours earlier than expected. This may be due to a missing in-progress check-in, as your job reported a duration of 12 minutes without sending one. The grace period for your monitor before the check-in is considered missed is 5 minutes.'
    );

    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('handles timeout check-in with duration less than max_runtime without showing late indicator', () => {
    // When a check-in's closing check-in is processed very late (due to being
    // stuck in relay) we should not show a CompletedLateIndicator, even though
    // it's `COMPLETE_TIMEOUT`.
    const checkIn = CheckInFixture({
      status: CheckInStatus.TIMEOUT,
      dateAdded: '2025-01-01T00:00:01Z',
      dateUpdated: '2025-01-01T00:05:00Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: 5 * 60 * 1000,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    // Should show timeout status but no late indicator since lateBySecond < 0
    expect(screen.getByText('Timed Out')).toBeInTheDocument();
    expect(screen.queryByText(/late/)).not.toBeInTheDocument();
  });

  it('shows processing latency indicator when check-in has high processing latency', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.OK,
      dateAdded: '2025-01-01T00:00:00Z', // When check-in was received by relay
      dateClock: '2025-01-01T00:02:00Z', // When check-in was placed in kafka (2 minutes later - high latency)
      dateUpdated: '2025-01-01T00:02:10Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: 9000,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    // Should show the processing latency info icon
    const infoIcon = screen.getByTestId('more-information');
    expect(infoIcon).toBeInTheDocument();

    await userEvent.hover(infoIcon);

    const expectedTooltip =
      'This check-in was processed late due to abnormal system latency in Sentry. The status of this check-in may be inaccurate.';
    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('shows processing latency indicator for abnormally late check-in', async () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.TIMEOUT,
      dateAdded: '2025-01-01T00:00:01Z',
      dateClock: '2025-01-01T00:00:01Z', // No processing latency
      dateUpdated: '2025-01-01T00:05:00Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: 5 * 60 * 1000, // 5 minutes - less than max_runtime of 10 minutes (abnormally late)
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    // Should show the processing latency info icon for abnormally late timing
    const infoIcon = screen.getByTestId('more-information');
    expect(infoIcon).toBeInTheDocument();

    await userEvent.hover(infoIcon);

    const expectedTooltip =
      'This check-in was incorrectly marked as timed-out. The check-in was processed late due to abnormal system latency in Sentry.';
    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('does not show processing latency indicator for normal check-ins', () => {
    const checkIn = CheckInFixture({
      status: CheckInStatus.OK,
      dateAdded: '2025-01-01T00:00:01Z',
      dateClock: '2025-01-01T00:00:02Z', // Only 1 second processing latency
      dateUpdated: '2025-01-01T00:00:10Z',
      dateInProgress: '2025-01-01T00:00:01Z',
      duration: null, // No duration to avoid abnormal late condition
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);
    expect(screen.queryByTestId('more-information')).not.toBeInTheDocument();
  });

  it('displays check-in ID and copy button', () => {
    const checkIn = CheckInFixture({
      id: 'abcd1234-5678-90ef-ghij-klmnopqrstuv',
      status: CheckInStatus.OK,
    });

    render(<MonitorCheckInsGrid project={project} checkIns={[checkIn]} />);

    // Check that the short ID is displayed
    expect(screen.getByText('abcd1234')).toBeInTheDocument();

    // Check that the copy button is present with the correct accessible name
    const copyButton = screen.getByRole('button', {name: 'Copy Check-In ID'});
    expect(copyButton).toBeInTheDocument();
  });
});
