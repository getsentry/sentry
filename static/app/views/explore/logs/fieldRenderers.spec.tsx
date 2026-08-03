import {Fragment} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {getDefaultPageFilterSelection} from 'sentry/components/pageFilters/constants';
import {TimezoneProvider} from 'sentry/components/timezoneProvider';
import {ConfigStore} from 'sentry/stores/configStore';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {OurLogKnownFieldKey, type LogRowItem} from 'sentry/views/explore/logs/types';

const TimestampRenderer = LogAttributesRendererMap[OurLogKnownFieldKey.TIMESTAMP];
const TraceIDRenderer = LogAttributesRendererMap[OurLogKnownFieldKey.TRACE_ID];

type LogFieldRendererProps = AttributesFieldRendererProps<RendererExtra>;

describe('Logs Field Renderers', () => {
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
      location: LocationFixture(),
      navigate: jest.fn(),
      theme: ThemeFixture(),
      attributeTypes: {},
      attributes,
      caseSensitiveHighlighting: false,
      datetime: getDefaultPageFilterSelection().datetime,
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

  describe('TimestampRenderer', () => {
    const timestamp = '2024-01-15T14:30:45.123Z';

    it('renders timestamp in 12h format by default', () => {
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

    it('renders timestamp in 24h format when user preference is set', () => {
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

    it('renders milliseconds when present', () => {
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

    it('uses precise timestamp when available', () => {
      expect(TimestampRenderer).toBeDefined();
      const preciseTimestamp = '1705329045123456789';
      const props = makeRendererProps(timestamp, {
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestamp,
      });
      const result = TimestampRenderer!(props);

      render(
        <TimezoneProvider timezone="UTC">
          <Fragment>{result}</Fragment>
        </TimezoneProvider>
      );
      expect(screen.getByText(/2:30:45\.123/)).toBeInTheDocument();
    });

    it('renders in different timezone', () => {
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

    it('renders in 24h format with different timezone', () => {
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

    it('renders tooltip on hover', async () => {
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

  describe('TraceIDRenderer', () => {
    const timestamp = '2024-01-15T14:30:45.123Z';
    const traceId = 'a'.repeat(32);

    const renderTraceLink = ({
      datetime,
      locationQuery = {},
      logTimestamp,
    }: {
      datetime: RendererExtra['datetime'];
      locationQuery?: Location['query'];
      logTimestamp?: string;
    }) => {
      const props = makeRendererProps(
        timestamp,
        logTimestamp ? {[OurLogKnownFieldKey.TIMESTAMP]: logTimestamp} : {}
      );
      const result = TraceIDRenderer!({
        ...props,
        item: {
          fieldKey: OurLogKnownFieldKey.TRACE_ID,
          value: traceId,
          metaFieldType: 'string',
          unit: null,
        } as LogRowItem,
        extra: {
          ...props.extra,
          datetime,
          location: LocationFixture({query: locationQuery}),
        },
        basicRendered: <span>{traceId}</span>,
      });

      render(<Fragment>{result}</Fragment>);

      const link = screen.getByRole('link', {name: traceId});

      return qs.parse(link.getAttribute('href')!.split('?')[1]!);
    };

    it('drops the date range when the log has a timestamp', () => {
      const query = renderTraceLink({
        datetime: {period: '10m', start: null, end: null, utc: null},
        locationQuery: {
          statsPeriod: '10m',
          start: '2024-01-15T14:20:00.000',
          end: '2024-01-15T14:40:00.000',
          utc: 'true',
        },
        logTimestamp: timestamp,
      });

      expect(query).toEqual({
        source: 'logs',
        timestamp: '1705329045.123',
      });
    });

    it('keeps the relative period when the log has no timestamp', () => {
      const query = renderTraceLink({
        datetime: {period: '7d', start: null, end: null, utc: null},
      });

      expect(query).toEqual(expect.objectContaining({statsPeriod: '7d'}));
    });

    it('keeps the absolute range when the log has no timestamp', () => {
      const query = renderTraceLink({
        datetime: {
          period: null,
          start: '2024-01-14T00:00:00.000',
          end: '2024-01-16T00:00:00.000',
          utc: true,
        },
      });

      expect(query).toEqual(
        expect.objectContaining({
          pageStart: '2024-01-14T00:00:00.000',
          pageEnd: '2024-01-16T00:00:00.000',
        })
      );
      expect(query).not.toHaveProperty('statsPeriod');
    });
  });
});
