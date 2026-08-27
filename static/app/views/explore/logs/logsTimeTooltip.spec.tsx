import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/datetime';

import {ConfigStore} from 'sentry/stores/configStore';
import {TimestampTooltipBody} from 'sentry/views/explore/logs/logsTimeTooltip';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

describe('TimestampTooltipBody', () => {
  const timestamp = '2024-01-15T15:45:30.456Z';

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('renders basic precise timestamp', () => {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </DateTimeProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024.*10:45:30\.456 AM EST/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024.*3:45:30\.456 PM UTC/)).toBeInTheDocument();
    expect(screen.getByText(/1705333530/)).toBeInTheDocument();
  });

  it('renders only timezone line when timezone is UTC', () => {
    const user = UserFixture();
    user.options.timezone = 'UTC';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'UTC', clockDisplay: '12'}}>
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </DateTimeProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024.*3:45:30\.456 PM UTC/)).toBeInTheDocument();
    const allTimestampElements = screen.getAllByText(/Jan 15, 2024.*3:45:30\.456 PM UTC/);
    expect(allTimestampElements).toHaveLength(1);
  });

  it('renders received time when observed timestamp is provided', () => {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
      [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: '1705333540456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </DateTimeProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.queryAllByRole('time')).toHaveLength(3);
  });

  it('does not render received time when observed timestamp is not provided', () => {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </DateTimeProvider>
    );

    expect(screen.queryByText('Received')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('time')).toHaveLength(2);
  });

  it('renders received time when the observed timestamp uses its internal name', () => {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
      [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_NANOS]: '1705333540456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </DateTimeProvider>
    );

    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.queryAllByRole('time')).toHaveLength(3);
  });

  it('renders a loading received time when the trace item details are still pending', () => {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '12'}}>
        <TimestampTooltipBody
          timestamp={timestamp}
          attributes={attributes}
          isTraceItemDetailsPending
        />
      </DateTimeProvider>
    );

    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders in 24h format when user preference is set', () => {
    const pmTimestamp = '2024-01-15T20:45:30.456Z';
    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705351530456789012',
    };

    render(
      <DateTimeProvider value={{timezone: 'America/New_York', clockDisplay: '24'}}>
        <TimestampTooltipBody timestamp={pmTimestamp} attributes={attributes} />
      </DateTimeProvider>
    );

    expect(screen.getByText(/15:45:30\.456/)).toBeInTheDocument();
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
  });
});
