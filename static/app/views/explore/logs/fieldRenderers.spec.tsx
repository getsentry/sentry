import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {TimezoneProvider} from 'sentry/components/timezoneProvider';
import ConfigStore from 'sentry/stores/configStore';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {type LogRowItem, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const TimestampRenderer = LogAttributesRendererMap[OurLogKnownFieldKey.TIMESTAMP];

type LogFieldRendererProps = AttributesFieldRendererProps<RendererExtra>;

describe('Logs Field Renderers', function () {
  const organization = OrganizationFixture();

  const makeRendererProps = (
    timestamp: string,
    attributes: Record<string, string | number> = {},
    shouldRenderHoverElements = false
  ): LogFieldRendererProps => ({
    item: {
      fieldKey: OurLogKnownFieldKey.TIMESTAMP,
      value: timestamp,
      metaFieldType: 'date',
      unit: null,
    } as LogRowItem,
    meta: {
      fields: {
        [OurLogKnownFieldKey.TIMESTAMP]: 'date',
      },
      units: {},
    },
    extra: {
      organization,
      location: {} as any,
      theme: ThemeFixture(),
      attributes,
      highlightTerms: [],
      logColors: {
        text: '#000',
        background: '#fff',
      } as any,
      projectSlug: 'test-project',
      shouldRenderHoverElements,
    },
    basicRendered: <span>{timestamp}</span>,
  });

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  describe('TimestampRenderer', function () {
    const timestamp = '2024-01-15T14:30:45.123Z';

    it('renders timestamp in 12h format by default', function () {
      expect(TimestampRenderer).toBeDefined();
      const props = makeRendererProps(timestamp);
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/Jan 15, 2024 2:30:45\.123 PM/)).toBeInTheDocument();
    });

    it('renders timestamp in 24h format when user preference is set', function () {
      expect(TimestampRenderer).toBeDefined();
      const user = UserFixture();
      user.options.clock24Hours = true;
      ConfigStore.set('user', user);

      const props = makeRendererProps(timestamp);
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/Jan 15, 2024 14:30:45\.123/)).toBeInTheDocument();
      expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
    });

    it('renders milliseconds when present', function () {
      expect(TimestampRenderer).toBeDefined();
      const props = makeRendererProps(timestamp);
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/\.123/)).toBeInTheDocument();
    });

    it('uses precise timestamp when available', function () {
      expect(TimestampRenderer).toBeDefined();
      const preciseTimestamp = '1705329045123456789';
      const props = makeRendererProps(timestamp, {
        'tags[sentry.timestamp_precise,number]': preciseTimestamp,
      });
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/2:30:45\.123/)).toBeInTheDocument();
    });

    it('renders in different timezone', function () {
      expect(TimestampRenderer).toBeDefined();
      const user = UserFixture();
      user.options.timezone = 'Europe/London';
      ConfigStore.set('user', user);

      const props = makeRendererProps(timestamp);
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/Jan 15, 2024 2:30:45\.123 PM/)).toBeInTheDocument();
    });

    it('renders in 24h format with different timezone', function () {
      expect(TimestampRenderer).toBeDefined();
      const user = UserFixture();
      user.options.timezone = 'Asia/Tokyo';
      user.options.clock24Hours = true;
      ConfigStore.set('user', user);

      const props = makeRendererProps(timestamp);
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="Asia/Tokyo">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/Jan 15, 2024 23:30:45\.123/)).toBeInTheDocument();
      expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
    });

    it('renders tooltip on hover', async function () {
      expect(TimestampRenderer).toBeDefined();
      const props = makeRendererProps(timestamp, {}, true);
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );

      const timestampElement = screen.getByText(/Jan 15, 2024 2:30:45\.123 PM/);
      expect(timestampElement).toBeInTheDocument();

      await userEvent.hover(timestampElement);

      await waitFor(() => {
        expect(screen.getByText(/Jan 15, 2024.*2:30:45\.123 PM UTC/)).toBeInTheDocument();
      });
    });
  });
});
