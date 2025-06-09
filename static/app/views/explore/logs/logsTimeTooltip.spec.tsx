import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TimezoneProvider} from 'sentry/components/timezoneProvider';
import ConfigStore from 'sentry/stores/configStore';
import {TimestampTooltipBody} from 'sentry/views/explore/logs/logsTimeTooltip';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

describe('TimestampTooltipBody', function () {
  const timestamp = '2024-01-15T15:45:30.456Z';

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('renders basic precise timestamp', function () {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <TimezoneProvider timezone="America/New_York">
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </TimezoneProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024.*10:45:30\.456 AM EST/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024.*3:45:30\.456 PM UTC/)).toBeInTheDocument();
    expect(screen.getByText(/1705333530/)).toBeInTheDocument();
  });

  it('renders only timezone line when timezone is UTC', function () {
    const user = UserFixture();
    user.options.timezone = 'UTC';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <TimezoneProvider timezone="UTC">
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </TimezoneProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024.*3:45:30\.456 PM UTC/)).toBeInTheDocument();
    const allTimestampElements = screen.getAllByText(/Jan 15, 2024.*3:45:30\.456 PM UTC/);
    expect(allTimestampElements).toHaveLength(1);
  });

  it('renders received time when observed timestamp is provided', function () {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
      [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: '1705333540456789012',
    };

    render(
      <TimezoneProvider timezone="America/New_York">
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </TimezoneProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
  });

  it('does not render received time when observed timestamp is not provided', function () {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    ConfigStore.set('user', user);

    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705333530456789012',
    };

    render(
      <TimezoneProvider timezone="America/New_York">
        <TimestampTooltipBody timestamp={timestamp} attributes={attributes} />
      </TimezoneProvider>
    );

    expect(screen.getByText('Occurred')).toBeInTheDocument();
    expect(screen.queryByText('Received')).not.toBeInTheDocument();
  });

  it('renders in 24h format when user preference is set', function () {
    const user = UserFixture();
    user.options.timezone = 'America/New_York';
    user.options.clock24Hours = true;
    ConfigStore.set('user', user);

    const pmTimestamp = '2024-01-15T20:45:30.456Z';
    const attributes = {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1705351530456789012',
    };

    render(
      <TimezoneProvider timezone="America/New_York">
        <TimestampTooltipBody timestamp={pmTimestamp} attributes={attributes} />
      </TimezoneProvider>
    );

    expect(screen.getByText(/15:45:30\.456/)).toBeInTheDocument();
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
  });
});
