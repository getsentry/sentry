import shuffle from 'lodash/shuffle';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import ConfigStore from 'sentry/stores/configStore';
import type {NewQuery, SavedQuery} from 'sentry/types/organization';
import type {Config} from 'sentry/types/system';
import type {MetaType} from 'sentry/utils/discover/eventView';
import EventView, {
  isAPIPayloadSimilar,
  pickRelevantLocationQueryStrings,
} from 'sentry/utils/discover/eventView';
import type {Column} from 'sentry/utils/discover/fields';
import {
  CHART_AXIS_OPTIONS,
  DiscoverDatasets,
  DISPLAY_MODE_OPTIONS,
  DisplayModes,
  SavedQueryDatasets,
} from 'sentry/utils/discover/types';
import {AggregationKey, WebVital} from 'sentry/utils/fields';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {EventsDisplayFilterName} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';

const generateFields = (fields: string[]) =>
  fields.map(field => ({
    field,
  }));

const generateSorts = (sorts: string[]) =>
  sorts.map(
    sortName =>
      ({
        field: sortName,
        kind: 'desc',
      }) as const
  );

const REQUIRED_CONSTRUCTOR_PROPS = {
  createdBy: undefined,
  end: undefined,
  environment: [],
  fields: [],
  name: undefined,
  project: [],
  query: '',
  start: undefined,
  team: [],
  sorts: [],
  statsPeriod: undefined,
  topEvents: undefined,
  id: undefined,
  display: undefined,
};

describe('EventView constructor', () => {
  it('instantiates default values', () => {
    const eventView = new EventView(REQUIRED_CONSTRUCTOR_PROPS);

    expect(eventView).toMatchObject({
      id: undefined,
      name: undefined,
      fields: [],
      sorts: [],
      query: '',
      project: [],
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: [],
      yAxis: undefined,
      display: undefined,
    });
  });
});

describe('EventView.fromLocation()', () => {
  it('maps query strings', () => {
    const location = LocationFixture({
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        widths: ['123', '456'],
        sort: ['title', '-count'],
        query: 'event.type:transaction',
        project: ['123'],
        team: ['myteams', '1', '2'],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '14d',
        environment: ['staging'],
        yAxis: 'p95',
        display: 'previous',
        dataset: DiscoverDatasets.DISCOVER,
      },
    });

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'id', width: 456},
      ],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:transaction',
      project: [123],
      team: ['myteams', 1, 2],
      start: undefined,
      end: undefined,
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'p95',
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
    });
  });

  it('includes first valid statsPeriod', () => {
    const location = LocationFixture({
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        widths: ['123', '456'],
        sort: ['title', '-count'],
        query: 'event.type:transaction',
        project: ['123'],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: ['invalid', '28d'],
        environment: ['staging'],
      },
    });

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'id', width: 456},
      ],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:transaction',
      project: [123],
      start: undefined,
      end: undefined,
      statsPeriod: '28d',
      environment: ['staging'],
    });
  });

  it('includes start and end', () => {
    const location = LocationFixture({
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        widths: ['123', '456'],
        sort: ['title', '-count'],
        query: 'event.type:transaction',
        project: ['123'],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        environment: ['staging'],
      },
    });

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'id', width: 456},
      ],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      environment: ['staging'],
    });
  });

  it('generates event view when there are no query strings', () => {
    const location = LocationFixture({
      query: {},
    });

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: void 0,
      name: void 0,
      fields: [],
      sorts: [],
      query: '',
      project: [],
      start: void 0,
      end: void 0,
      statsPeriod: '14d',
      environment: [],
      yAxis: void 0,
    });
  });
});

describe('EventView.fromSavedQuery()', () => {
  it('maps basic properties of saved query', () => {
    const saved: SavedQuery = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      teams: ['myteams', 1],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
      dateCreated: '2019-10-30T06:13:17.632078Z',
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      version: 2,
    };
    const eventView = EventView.fromSavedQuery(saved);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      team: ['myteams', 1],
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: undefined,
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
    });

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      range: undefined,
    });
    expect(eventView2).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      team: ['myteams', 1],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      statsPeriod: undefined,
      environment: ['staging'],
    });
  });

  it('maps saved query with no conditions', () => {
    const saved: SavedQuery = {
      orderby: '-count',
      name: 'foo bar',
      fields: ['release', 'count()'],
      widths: ['111', '222'],
      dateCreated: '2019-10-30T06:13:17.632078Z',
      environment: ['dev', 'production'],
      version: 2,
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      id: '5',
      projects: [1],
      yAxis: ['count()'],
    };

    const eventView = EventView.fromSavedQuery(saved);

    const expected = {
      id: '5',
      name: 'foo bar',
      fields: [
        {field: 'release', width: 111},
        {field: 'count()', width: 222},
      ],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: '',
      project: [1],
      environment: ['dev', 'production'],
      yAxis: 'count()',
    };

    expect(eventView).toMatchObject(expected);
  });

  it('maps properties from v2 saved query', () => {
    const saved: SavedQuery = {
      id: '42',
      projects: [123],
      name: 'best query',
      fields: ['count()', 'title'],
      range: '14d',
      start: '',
      end: '',
      dateCreated: '2019-10-30T06:13:17.632078Z',
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      version: 2,
    };
    const eventView = EventView.fromSavedQuery(saved);
    expect(eventView.fields).toEqual([
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
      {field: 'title', width: COL_WIDTH_UNDEFINED},
    ]);
    expect(eventView.name).toEqual(saved.name);
    expect(eventView.statsPeriod).toBe('14d');
    expect(eventView.start).toBeUndefined();
    expect(eventView.end).toBeUndefined();
  });

  it('saved queries are equal when start and end datetime differ in format', () => {
    const saved: SavedQuery = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      version: 2,
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
      projects: [1],
    };

    const eventView = EventView.fromSavedQuery(saved);

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      start: '2019-10-20T21:02:51Z',
      end: '2019-10-23T19:27:04Z',
    });

    expect(eventView.isEqualTo(eventView2)).toBe(true);

    const eventView3 = EventView.fromSavedQuery({
      ...saved,
      start: '2019-10-20T21:02:51Z',
    });

    expect(eventView.isEqualTo(eventView3)).toBe(true);

    const eventView4 = EventView.fromSavedQuery({
      ...saved,
      end: '2019-10-23T19:27:04Z',
    });

    expect(eventView.isEqualTo(eventView4)).toBe(true);
  });

  it('saved queries are not equal when datetime selection are invalid', () => {
    const saved: SavedQuery = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      version: 2,
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
      projects: [1],
    };

    const eventView = EventView.fromSavedQuery(saved);

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      start: '',
    });

    expect(eventView.isEqualTo(eventView2)).toBe(false);

    const eventView3 = EventView.fromSavedQuery({
      ...saved,
      end: '',
    });

    expect(eventView.isEqualTo(eventView3)).toBe(false);

    // this is expected since datetime (start and end) are normalized
    expect(eventView2.isEqualTo(eventView3)).toBe(true);
  });

  it('saved queries with undefined yAxis are defaulted to count() when comparing with isEqualTo', () => {
    const saved: SavedQuery = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      version: 2,
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
      projects: [1],
    };

    const eventView = EventView.fromSavedQuery(saved);

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      yAxis: ['count()'],
    });

    expect(eventView.isEqualTo(eventView2)).toBe(true);
  });

  it('uses the first yAxis from the SavedQuery', () => {
    const saved: SavedQuery = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      teams: ['myteams', 1],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
      yAxis: ['count()'],
      dateCreated: '2019-10-30T06:13:17.632078Z',
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      version: 2,
    };
    const eventView = EventView.fromSavedQuery(saved);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      team: ['myteams', 1],
      start: undefined,
      end: undefined,
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'count()',
      dataset: DiscoverDatasets.DISCOVER,
      display: 'previous',
    });
  });

  it('preserves utc with start/end', () => {
    const saved: SavedQuery = {
      id: '42',
      version: 2,
      projects: [123],
      name: 'best query',
      query: 'event.type:transaction',
      fields: ['count()', 'title'],
      start: '2019-10-20T21:02:51+0000',
      end: '2019-10-23T19:27:04+0000',
      utc: 'true',

      dateCreated: '2019-10-30T06:13:17.632078Z',
      dateUpdated: '2019-10-30T06:13:17.632096Z',
    };
    const eventView = EventView.fromSavedQuery(saved);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'title', width: COL_WIDTH_UNDEFINED},
      ],
      query: 'event.type:transaction',
      start: '2019-10-20T21:02:51.000',
      end: '2019-10-23T19:27:04.000',
      utc: 'true',
    });
  });
});

describe('EventView.fromNewQueryWithPageFilters()', () => {
  const prebuiltQuery: NewQuery = {
    id: undefined,
    name: 'Page Filter Events',
    query: '',
    projects: undefined,
    fields: ['title', 'project', 'timestamp'],
    orderby: '-timestamp',
    version: 2,
  };

  it('maps basic properties of a prebuilt query', () => {
    const pageFilters = PageFiltersFixture();

    const eventView = EventView.fromNewQueryWithPageFilters(prebuiltQuery, pageFilters);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'Page Filter Events',
      fields: [{field: 'title'}, {field: 'project'}, {field: 'timestamp'}],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [],
      start: undefined,
      end: undefined,
      statsPeriod: '14d',
      environment: [],
      yAxis: undefined,
    });
  });

  it('merges page filter values', () => {
    const pageFilters = PageFiltersFixture({
      datetime: {
        period: '3d',
        start: null,
        end: null,
        utc: null,
      },
      projects: [42],
      environments: ['prod'],
    });

    const eventView = EventView.fromNewQueryWithPageFilters(prebuiltQuery, pageFilters);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'Page Filter Events',
      fields: [{field: 'title'}, {field: 'project'}, {field: 'timestamp'}],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [42],
      start: undefined,
      end: undefined,
      statsPeriod: '3d',
      environment: ['prod'],
      yAxis: undefined,
    });
  });
});

describe('EventView.fromNewQueryWithLocation()', () => {
  const prebuiltQuery: NewQuery = {
    id: undefined,
    name: 'Sampled Events',
    query: '',
    projects: [],
    fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
    orderby: '-timestamp',
    version: 2,
  };

  it('maps basic properties of a prebuilt query', () => {
    const location = LocationFixture({
      query: {
        statsPeriod: '99d',
      },
    });

    const eventView = EventView.fromNewQueryWithLocation(prebuiltQuery, location);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'Sampled Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [],
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '99d',
      environment: [],
      yAxis: undefined,
    });
  });

  it('merges global selection values', () => {
    const location = LocationFixture({
      query: {
        statsPeriod: '99d',
        project: ['456'],
        environment: ['prod'],
      },
    });

    const eventView = EventView.fromNewQueryWithLocation(prebuiltQuery, location);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'Sampled Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [456],
      start: undefined,
      end: undefined,
      statsPeriod: '99d',
      environment: ['prod'],
      yAxis: undefined,
    });
  });

  it('new query takes precedence over global selection values', () => {
    const location = LocationFixture({
      query: {
        statsPeriod: '99d',
        project: ['456'],
        environment: ['prod'],
      },
    });

    const prebuiltQuery2: NewQuery = {
      ...prebuiltQuery,
      range: '42d',
      projects: [987],
      environment: ['staging'],
    };

    const eventView = EventView.fromNewQueryWithLocation(prebuiltQuery2, location);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'Sampled Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [987],
      start: undefined,
      end: undefined,
      statsPeriod: '42d',
      environment: ['staging'],
      yAxis: undefined,
    });

    // also test start and end

    const location2 = LocationFixture({
      query: {
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        project: ['456'],
        environment: ['prod'],
      },
    });

    const prebuiltQuery3: NewQuery = {
      ...prebuiltQuery,
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      projects: [987],
      environment: ['staging'],
    };

    const eventView2 = EventView.fromNewQueryWithLocation(prebuiltQuery3, location2);

    expect(eventView2).toMatchObject({
      id: undefined,
      name: 'Sampled Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [987],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      statsPeriod: undefined,
      environment: ['staging'],
      yAxis: undefined,
    });
  });
});

describe('EventView.fromSavedQueryOrLocation()', () => {
  it('maps basic properties of saved query', () => {
    const saved: SavedQuery = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      dateCreated: '2019-10-30T06:13:17.632078Z',
      version: 2,
    };

    const location = LocationFixture({
      query: {
        statsPeriod: '14d',
        project: ['123'],
        team: ['myteams', '1', '2'],
        environment: ['staging'],
      },
    });
    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      team: ['myteams', 1, 2],
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: undefined,
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
    });

    const savedQuery2: SavedQuery = {...saved, range: undefined};
    const location2 = LocationFixture({
      query: {
        project: ['123'],
        environment: ['staging'],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
      },
    });

    const eventView2 = EventView.fromSavedQueryOrLocation(savedQuery2, location2);

    expect(eventView2).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      statsPeriod: undefined,
      environment: ['staging'],
    });
  });

  it('overrides saved query params with location params', () => {
    const saved: SavedQuery = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      dateCreated: '2019-10-30T06:13:17.632078Z',
      version: 2,
    };

    const location = LocationFixture({
      query: {
        id: '42',
        statsPeriod: '7d',
        project: ['3'],
      },
    });
    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [3],
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '7d',
      environment: [],
      yAxis: undefined,
      display: 'previous',
      dataset: DiscoverDatasets.DISCOVER,
    });
  });

  it('maps saved query with no conditions', () => {
    const saved: SavedQuery = {
      orderby: '-count',
      name: 'foo bar',
      fields: ['release', 'count()'],
      widths: ['111', '222'],
      dateCreated: '2019-10-30T06:13:17.632078Z',
      query: '',
      environment: [],
      version: 2,
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      projects: [123],
      id: '5',
      yAxis: ['count()'],
    };

    const location = LocationFixture({
      query: {
        id: '5',
        project: ['1'],
      },
    });

    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    const expected = {
      id: '5',
      name: 'foo bar',
      fields: [
        {field: 'release', width: 111},
        {field: 'count()', width: 222},
      ],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: '',
      project: [1],
      yAxis: 'count()',
    };

    expect(eventView).toMatchObject(expected);
  });

  it('maps query with cleared conditions', () => {
    const saved: SavedQuery = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      dateCreated: '2019-10-30T06:13:17.632078Z',
      version: 2,
    };

    const location = LocationFixture({
      query: {
        id: '42',
        statsPeriod: '7d',
      },
    });
    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '7d',
      environment: [],
      yAxis: undefined,
      display: 'previous',
    });

    const location2 = LocationFixture({
      query: {
        id: '42',
        statsPeriod: '7d',
        query: '',
      },
    });
    const eventView2 = EventView.fromSavedQueryOrLocation(saved, location2);

    expect(eventView2).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: '',
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '7d',
      environment: [],
      yAxis: undefined,
      display: 'previous',
    });
  });

  it('event views are equal when start and end datetime differ in format', () => {
    const saved: SavedQuery = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      projects: [123],
      version: 2,
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
    };

    const location = LocationFixture({
      query: {
        id: '3',
        start: '2019-10-20T21:02:51+0000',
        end: '2019-10-23T19:27:04+0000',
      },
    });

    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    const location2 = LocationFixture({
      query: {
        id: '3',
        start: '2019-10-20T21:02:51Z',
        end: '2019-10-23T19:27:04Z',
      },
    });
    const eventView2 = EventView.fromSavedQueryOrLocation(saved, location2);

    expect(eventView.isEqualTo(eventView2)).toBe(true);

    const location3 = LocationFixture({
      query: {
        id: '3',
        start: '2019-10-20T21:02:51Z',
        end: '2019-10-23T19:27:04+0000',
      },
    });
    const eventView3 = EventView.fromSavedQueryOrLocation(saved, location3);

    expect(eventView.isEqualTo(eventView3)).toBe(true);

    const location4 = LocationFixture({
      query: {
        id: '3',
        start: '2019-10-20T21:02:51+0000',
        end: '2019-10-23T19:27:04Z',
      },
    });
    const eventView4 = EventView.fromSavedQueryOrLocation(saved, location4);

    expect(eventView.isEqualTo(eventView4)).toBe(true);
  });

  it('event views are not equal when datetime selection are invalid', () => {
    const saved: SavedQuery = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      version: 2,
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
      projects: [1],
    };

    const location = LocationFixture({
      query: {
        id: '3',
        end: '2019-10-23T19:27:04+0000',
        start: '2019-10-20T21:02:51+0000',
      },
    });

    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    const location2 = LocationFixture({
      query: {
        id: '3',
        end: '2019-10-23T19:27:04+0000',
        start: '',
      },
    });
    const eventView2 = EventView.fromSavedQueryOrLocation(saved, location2);

    expect(eventView.isEqualTo(eventView2)).toBe(false);

    const location3 = LocationFixture({
      query: {
        id: '3',
        end: '',
        start: '2019-10-20T21:02:51+0000',
      },
    });
    const eventView3 = EventView.fromSavedQueryOrLocation(saved, location3);

    expect(eventView.isEqualTo(eventView3)).toBe(false);

    // this is expected since datetime (start and end) are normalized
    expect(eventView2.isEqualTo(eventView3)).toBe(true);
  });

  it('uses the first yAxis from the SavedQuery', () => {
    const saved: SavedQuery = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
      yAxis: ['count()', 'failure_count()'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      version: 2,
    };

    const location = LocationFixture({
      query: {
        statsPeriod: '14d',
        project: ['123'],
        team: ['myteams', '1', '2'],
        environment: ['staging'],
      },
    });
    const eventView = EventView.fromSavedQueryOrLocation(saved, location);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      team: ['myteams', 1, 2],
      start: undefined,
      end: undefined,
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'count()',
      display: 'previous',
    });
  });

  it('filters out invalid teams', () => {
    const eventView = EventView.fromSavedQueryOrLocation(
      undefined,
      LocationFixture({
        query: {
          statsPeriod: '14d',
          project: ['123'],
          team: ['myteams', '1', 'unassigned'],
          environment: ['staging'],
        },
      })
    );

    expect(eventView.team).toEqual(['myteams', 1]);
  });
});

describe('EventView.generateQueryStringObject()', () => {
  it('skips empty values', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['id', 'title']),
      sorts: [],
      project: [],
      environment: [],
      statsPeriod: '',
      start: undefined,
      end: undefined,
      yAxis: undefined,
      display: 'previous',
    });

    const expected = {
      id: undefined,
      name: undefined,
      field: ['id', 'title'],
      widths: undefined,
      sort: undefined,
      query: '',
      project: undefined,
      environment: undefined,
      display: 'previous',
      yAxis: 'count()',
    };

    expect(eventView.generateQueryStringObject()).toEqual(expected);
  });

  it('generates query string object', () => {
    const state: ConstructorParameters<typeof EventView>[0] = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '1234',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'issue', width: 456},
      ],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'count()',
      display: 'releases',
      interval: '1m',
    };

    const eventView = new EventView(state);

    const expected = {
      id: '1234',
      name: 'best query',
      field: ['count()', 'issue'],
      widths: ['123', '456'],
      sort: '-count',
      query: 'event.type:error',
      project: '42',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: 'staging',
      yAxis: 'count()',
      display: 'releases',
      interval: '1m',
    };

    expect(eventView.generateQueryStringObject()).toEqual(expected);
  });

  it('encodes fields', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'id'}, {field: 'title'}],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    expect(query.field).toEqual(['id', 'title']);
  });

  it('returns a copy of data preventing mutation', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'id'}, {field: 'title'}],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    if (Array.isArray(query.field)) {
      query.field.push('newthing');
    }

    // Getting the query again should return the original values.
    const secondQuery = eventView.generateQueryStringObject();
    expect(secondQuery.field).toEqual(['id', 'title']);

    expect(query).not.toEqual(secondQuery);
  });
});

describe('EventView.getEventsAPIPayload()', () => {
  it('generates the API payload', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '34',
      name: 'amazing query',
      fields: generateFields(['id']),
      sorts: generateSorts(['id']),
      query: 'event.type:csp',
      project: [567],
      environment: ['prod'],
      yAxis: 'users',
      display: 'releases',
    });

    expect(eventView.getEventsAPIPayload(LocationFixture())).toEqual({
      field: ['id'],
      per_page: 50,
      sort: '-id',
      query: 'event.type:csp',
      project: ['567'],
      environment: ['prod'],
      statsPeriod: '14d',
    });
  });

  it('does not append query conditions in location', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['id']),
      sorts: [],
      query: 'event.type:csp',
    });

    const location = LocationFixture({
      query: {
        query: 'TypeError',
      },
    });
    expect(eventView.getEventsAPIPayload(location).query).toBe('event.type:csp');
  });

  it('only includes at most one sort key', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['count()', 'title']),
      sorts: generateSorts(['title', AggregationKey.COUNT]),
      query: 'event.type:csp',
    });

    const location = LocationFixture({
      query: {},
    });

    expect(eventView.getEventsAPIPayload(location).sort).toBe('-title');
  });

  it('only includes sort keys that are defined in fields', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', AggregationKey.COUNT]),
      query: 'event.type:csp',
    });

    const location = LocationFixture({
      query: {},
    });

    expect(eventView.getEventsAPIPayload(location).sort).toBe('-count');
  });

  it('only includes relevant query strings', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', AggregationKey.COUNT]),
      query: 'event.type:csp',
    });

    const location = LocationFixture({
      query: {
        start: '2020-08-12 12:13:14',
        end: '2020-08-26 12:13:14',
        utc: 'true',
        statsPeriod: '14d',
        cursor: 'some cursor',
        yAxis: 'count()',

        // irrelevant query strings
        bestCountry: 'canada',
        project: '1234',
        environment: ['staging'],
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: [],
      environment: [],
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });

  it('includes default coerced statsPeriod when omitted or is invalid', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', AggregationKey.COUNT]),
      query: 'event.type:csp',
      project: [1234],
      environment: ['staging'],
    });

    const location = LocationFixture({
      query: {
        start: '',
        end: '',
        utc: 'true',
        // invalid statsPeriod string
        statsPeriod: 'invalid',
        cursor: 'some cursor',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });

    const location2 = LocationFixture({
      query: {
        start: '',
        end: '',
        utc: 'true',
        // statsPeriod is omitted here
        cursor: 'some cursor',
      },
    });

    expect(eventView.getEventsAPIPayload(location2)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });

  it('includes default coerced statsPeriod when either start or end is only provided', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', AggregationKey.COUNT]),
      query: 'event.type:csp',
      project: [1234],
      environment: ['staging'],
    });

    const location = LocationFixture({
      query: {
        start: '',
        utc: 'true',
        statsPeriod: 'invalid',
        cursor: 'some cursor',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });

    const location2 = LocationFixture({
      query: {
        end: '',
        utc: 'true',
        statsPeriod: 'invalid',
        cursor: 'some cursor',
      },
    });

    expect(eventView.getEventsAPIPayload(location2)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });

  it('includes start and end', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:csp',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      environment: [],
      project: [],
    });

    const location = LocationFixture({
      query: {
        // these should not be part of the API payload
        statsPeriod: '55d',
        period: '55d',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      field: ['title', 'count()'],
      sort: '-count',
      query: 'event.type:csp',
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      per_page: 50,
      project: [],
      environment: [],
    });
  });

  it("an eventview's date selection has higher precedence than the date selection in the query string", () => {
    const initialState = {
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:csp',
      environment: [],
      project: [],
    };

    const output = {
      field: ['title', 'count()'],
      sort: '-count',
      query: 'event.type:csp',
      per_page: 50,
      project: [],
      environment: [],
    };

    // eventview's statsPeriod has highest precedence

    let eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      ...initialState,
      statsPeriod: '90d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
    });

    let location = LocationFixture({
      query: {
        // these should not be part of the API payload
        statsPeriod: '55d',
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      statsPeriod: '90d',
    });

    // eventview's start/end has higher precedence than the date selection in the query string

    eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      ...initialState,
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
    });

    location = LocationFixture({
      query: {
        // these should not be part of the API payload
        statsPeriod: '55d',
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
    });

    // the date selection in the query string should be applied as expected

    eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      ...initialState,
    });

    location = LocationFixture({
      query: {
        statsPeriod: '55d',
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      statsPeriod: '55d',
    });

    location = LocationFixture({
      query: {
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      statsPeriod: '30d',
    });

    location = LocationFixture({
      query: {
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    });

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      start: '2020-10-01T00:00:00.000',
      end: '2020-10-02T00:00:00.000',
    });
  });
});

describe('EventView.getFacetsAPIPayload()', () => {
  it('only includes relevant query strings', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', AggregationKey.COUNT]),
      query: 'event.type:csp',
    });

    const location = LocationFixture({
      query: {
        start: '',
        end: '',
        utc: 'true',
        statsPeriod: '14d',

        // irrelevant query strings
        bestCountry: 'canada',
        cursor: 'some cursor',
        sort: 'the world',
        project: '1234',
        environment: ['staging'],
        display: 'releases',
      },
    });

    expect(eventView.getFacetsAPIPayload(location)).toEqual({
      project: [],
      environment: [],
      statsPeriod: '14d',

      query: 'event.type:csp',
    });
  });
});

describe('EventView.toNewQuery()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', width: 123},
      {field: 'issue', width: 456},
    ],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
    display: 'releases',
    dataset: DiscoverDatasets.DISCOVER,
  };

  it('outputs the right fields', () => {
    const eventView = new EventView(state);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fields: ['count()', 'issue'],
      widths: ['123', '456'],
      orderby: '-count',
      query: 'event.type:error',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
      display: 'releases',
      dataset: DiscoverDatasets.DISCOVER,
      queryDataset: SavedQueryDatasets.DISCOVER,
    };

    expect(output).toEqual(expected);
  });

  it('omits query when query is an empty string', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
    };

    modifiedState.query = '';

    const eventView = new EventView(modifiedState);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fields: ['count()', 'issue'],
      widths: ['123', '456'],
      orderby: '-count',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
      display: 'releases',
      dataset: DiscoverDatasets.DISCOVER,
      queryDataset: SavedQueryDatasets.DISCOVER,
    };

    expect(output).toEqual(expected);
  });

  it('omits query when query is not defined', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
    };

    modifiedState.query = '';

    const eventView = new EventView(modifiedState);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fields: ['count()', 'issue'],
      widths: ['123', '456'],
      orderby: '-count',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
      display: 'releases',
      dataset: DiscoverDatasets.DISCOVER,
      queryDataset: SavedQueryDatasets.DISCOVER,
    };

    expect(output).toEqual(expected);
  });
});

describe('EventView.isValid()', () => {
  it('event view is valid when there is at least one field', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: [],
      project: [],
    });

    expect(eventView.isValid()).toBe(true);
  });

  it('event view is not valid when there are no fields', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [],
      sorts: [],
      project: [],
    });

    expect(eventView.isValid()).toBe(false);
  });
});

describe('EventView.getWidths()', () => {
  it('returns widths', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'issue', width: 2020},
        {field: 'title', width: COL_WIDTH_UNDEFINED},
        {field: 'time', width: 420},
        {field: 'lcp', width: 69},
        {field: 'lcp', width: COL_WIDTH_UNDEFINED},
        {field: 'fcp', width: COL_WIDTH_UNDEFINED},
        {field: 'cls', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [],
      project: [],
    });

    expect(eventView.getWidths()).toEqual([
      COL_WIDTH_UNDEFINED,
      2020,
      COL_WIDTH_UNDEFINED,
      420,
      69,
    ]);
  });
});

describe('EventView.getFields()', () => {
  it('returns fields', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: [],
      project: [],
    });

    expect(eventView.getFields()).toEqual(['count()', 'issue']);
  });
});

describe('EventView.numOfColumns()', () => {
  it('returns correct number of columns', () => {
    // has columns

    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: [],
      project: [],
    });

    expect(eventView.numOfColumns()).toBe(2);

    // has no columns

    const eventView2 = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [],
      sorts: [],
      project: [],
    });

    expect(eventView2.numOfColumns()).toBe(0);
  });
});

describe('EventView.getDays()', () => {
  it('returns the right number of days for statsPeriod', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      statsPeriod: '14d',
    });

    expect(eventView.getDays()).toBe(14);

    const eventView2 = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      statsPeriod: '12h',
    });

    expect(eventView2.getDays()).toBe(0.5);
  });

  it('returns the right number of days for start/end', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
    });

    expect(eventView.getDays()).toBe(1);

    const eventView2 = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      start: '2019-10-01T00:00:00',
      end: '2019-10-15T00:00:00',
    });
    expect(eventView2.getDays()).toBe(14);
  });
});

describe('EventView.clone()', () => {
  it('returns a unique instance', () => {
    const state: ConstructorParameters<typeof EventView>[0] = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      interval: '5m',
      display: 'releases',
      dataset: DiscoverDatasets.DISCOVER,
    };

    const eventView = new EventView(state);

    const eventView2 = eventView.clone();

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);
    expect(eventView2).toMatchObject(state);
    expect(eventView.isEqualTo(eventView2)).toBe(true);
    expect(
      eventView.additionalConditions === eventView2.additionalConditions
    ).toBeFalsy();
  });
});

describe('EventView.withColumns()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', width: 30},
      {field: 'issue', width: 99},
      {field: 'failure_count()', width: 30},
    ],
    yAxis: 'failure_count()',
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };
  const eventView = new EventView(state);

  it('adds new columns, and replaces existing ones', () => {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'title'},
      {kind: 'function', function: [AggregationKey.COUNT, '', undefined, undefined]},
      {kind: 'field', field: 'issue'},
      {kind: 'field', field: 'culprit'},
    ]);
    // Views should be different.
    expect(newView.isEqualTo(eventView)).toBe(false);
    expect(newView.fields).toEqual([
      {field: 'title', width: COL_WIDTH_UNDEFINED},
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
      {field: 'issue', width: COL_WIDTH_UNDEFINED},
      {field: 'culprit', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  it('drops empty columns', () => {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'issue'},
      {kind: 'function', function: [AggregationKey.COUNT, '', undefined, undefined]},
      {kind: 'field', field: ''},
      {kind: 'function', function: ['', '', undefined, undefined]},
      {kind: 'function', function: ['', '', undefined, undefined]},
    ]);
    expect(newView.fields).toEqual([
      {field: 'issue', width: COL_WIDTH_UNDEFINED},
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  it('inherits widths from existing columns when names match', () => {
    const newView = eventView.withColumns([
      {kind: 'function', function: [AggregationKey.COUNT, '', undefined, undefined]},
      {kind: 'field', field: 'issue'},
      {kind: 'field', field: 'title'},
      {kind: 'field', field: 'time'},
    ]);

    expect(newView.fields).toEqual([
      {field: 'count()', width: 30},
      {field: 'issue', width: 99},
      {field: 'title', width: COL_WIDTH_UNDEFINED},
      {field: 'time', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  it('retains sorts when sorted field is included', () => {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'title'},
      {kind: 'function', function: [AggregationKey.COUNT, '', undefined, undefined]},
    ]);
    expect(newView.fields).toEqual([
      {field: 'title', width: COL_WIDTH_UNDEFINED},
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
    ]);
    expect(newView.sorts).toEqual([{field: AggregationKey.COUNT, kind: 'desc'}]);
  });

  it('updates sorts when sorted field is removed', () => {
    const newView = eventView.withColumns([{kind: 'field', field: 'title'}]);
    expect(newView.fields).toEqual([{field: 'title', width: COL_WIDTH_UNDEFINED}]);
    // Should pick a sortable field.
    expect(newView.sorts).toEqual([{field: 'title', kind: 'desc'}]);
  });

  it('has no sort if no sortable fields remain', () => {
    const newView = eventView.withColumns([{kind: 'field', field: 'issue'}]);
    expect(newView.fields).toEqual([{field: 'issue', width: COL_WIDTH_UNDEFINED}]);
    expect(newView.sorts).toEqual([]);
  });
  it('updates yAxis if column is dropped', () => {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'count()'},
      {kind: 'field', field: 'issue'},
    ]);

    expect(newView.fields).toEqual([
      {field: 'count()', width: 30},
      {field: 'issue', width: 99},
    ]);

    expect(eventView.yAxis).toBe('failure_count()');
    expect(newView.yAxis).toBe('count()');
  });
});

describe('EventView.withNewColumn()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', width: 30},
      {field: 'issue', width: 99},
    ],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('adds a field', () => {
    const eventView = new EventView(state);
    const newColumn: Column = {
      kind: 'field',
      field: 'title',
    };
    const eventView2 = eventView.withNewColumn(newColumn);
    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'title'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('adds an aggregate function with no arguments', () => {
    const eventView = new EventView(state);
    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.COUNT, '', undefined, undefined],
    };

    const eventView2 = eventView.withNewColumn(newColumn);
    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'count()'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('add an aggregate function with field', () => {
    const eventView = new EventView(state);
    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.AVG, 'transaction.duration', undefined, undefined],
    };
    const eventView2 = eventView.withNewColumn(newColumn);
    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'avg(transaction.duration)'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('add an aggregate function with field & refinement', () => {
    const eventView = new EventView(state);
    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.PERCENTILE, 'transaction.duration', '0.5', undefined],
    };
    const updated = eventView.withNewColumn(newColumn);
    expect(updated.fields).toEqual([
      ...state.fields,
      {field: 'percentile(transaction.duration,0.5)', width: COL_WIDTH_UNDEFINED},
    ]);
  });
});

describe('EventView.withResizedColumn()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };
  const view = new EventView(state);

  it('updates a column that exists', () => {
    const newView = view.withResizedColumn(0, 99);
    expect(view.fields[0]!.width).toBeUndefined();
    expect(newView.fields[0]!.width).toBe(99);
  });

  it('ignores columns that do not exist', () => {
    const newView = view.withResizedColumn(100, 99);
    expect(view.fields).toEqual(newView.fields);
  });
});

describe('EventView.withUpdatedColumn()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta: MetaType = {
    count: 'integer',
    title: 'string',
  };

  it('update a column with no changes', () => {
    const eventView = new EventView(state);

    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.COUNT, '', undefined, undefined],
    };

    const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);
  });

  it('update a column to a field', () => {
    const eventView = new EventView(state);

    const newColumn: Column = {
      kind: 'field',
      field: 'title',
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'title'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with no arguments', () => {
    const eventView = new EventView(state);

    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.COUNT, '', undefined, undefined],
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'count()'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with field', () => {
    const eventView = new EventView(state);

    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.AVG, 'transaction.duration', undefined, undefined],
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'avg(transaction.duration)'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with field & refinement', () => {
    const eventView = new EventView(state);

    const newColumn: Column = {
      kind: 'function',
      function: [AggregationKey.PERCENTILE, 'transaction.duration', '0.5', undefined],
    };

    const newView = eventView.withUpdatedColumn(1, newColumn, meta);
    expect(newView.fields).toEqual([
      state.fields[0],
      {field: 'percentile(transaction.duration,0.5)', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  describe('update a column that is sorted', () => {
    it('the sorted column is the only sorted column', () => {
      const eventView = new EventView(state);

      const newColumn: Column = {
        kind: 'field',
        field: 'title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(state);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'title'}, state.fields[1]],
      };
      expect(eventView2).toMatchObject(nextState);
    });

    it('the sorted column occurs at least twice', () => {
      const modifiedState: ConstructorParameters<typeof EventView>[0] = {
        ...state,
        fields: [...state.fields, {field: 'count()'}],
      };

      const eventView = new EventView(modifiedState);

      const newColumn: Column = {
        kind: 'field',
        field: 'title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        fields: [{field: 'title'}, state.fields[1], {field: 'count()'}],
      };
      expect(eventView2).toMatchObject(nextState);
    });

    it('using no provided table meta', () => {
      // table meta may not be provided in the invalid query state;
      // we will still want to be able to update columns

      const eventView = new EventView(state);

      const expected = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'title'}, state.fields[1]],
      };

      const newColumn: Column = {
        kind: 'field',
        field: 'title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, {});
      expect(eventView2).toMatchObject(expected);

      const eventView3 = eventView.withUpdatedColumn(0, newColumn, undefined);
      expect(eventView3).toMatchObject(expected);
    });
  });

  describe('update a column to a non-sortable column', () => {
    it('default to a sortable column', () => {
      const modifiedState: ConstructorParameters<typeof EventView>[0] = {
        ...state,
        fields: [{field: 'count()'}, {field: 'title'}],
      };

      const eventView = new EventView(modifiedState);

      // this column is expected to be non-sortable
      const newColumn: Column = {
        kind: 'field',
        field: 'issue',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'issue'}, {field: 'title'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('has no sort if there are no sortable columns', () => {
      const modifiedState: ConstructorParameters<typeof EventView>[0] = {
        ...state,
        fields: [{field: 'count()'}],
      };

      const eventView = new EventView(modifiedState);

      // this column is expected to be non-sortable
      const newColumn: Column = {
        kind: 'field',
        field: 'issue',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [],
        fields: [{field: 'issue'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });
  });
});

describe('EventView.withDeletedColumn()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta: MetaType = {
    count: 'integer',
    title: 'string',
  };

  it('returns itself when attempting to delete the last remaining column', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
      fields: [{field: 'count()'}],
    };

    const eventView = new EventView(modifiedState);

    const eventView2 = eventView.withDeletedColumn(0, meta);

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(modifiedState);
  });

  describe('deletes column, and use any remaining sortable column', () => {
    it('using no provided table meta', () => {
      // table meta may not be provided in the invalid query state;
      // we will still want to be able to delete columns

      const state2 = {
        ...state,
        fields: [{field: 'title'}, {field: 'timestamp'}, {field: 'count()'}],
        sorts: generateSorts(['timestamp']),
      };

      const eventView = new EventView(state2);

      const expected = {
        ...state,
        sorts: generateSorts(['title']),
        fields: [{field: 'title'}, {field: 'count()'}],
      };

      const eventView2 = eventView.withDeletedColumn(1, {});
      expect(eventView2).toMatchObject(expected);

      const eventView3 = eventView.withDeletedColumn(1, undefined);
      expect(eventView3).toMatchObject(expected);
    });

    it('has no remaining sortable column', () => {
      const eventView = new EventView(state);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(state);

      const nextState = {
        ...state,
        // we expect sorts to be empty since issue is non-sortable
        sorts: [],
        fields: [state.fields[1]],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('has a remaining sortable column', () => {
      const modifiedState: ConstructorParameters<typeof EventView>[0] = {
        ...state,
        fields: [{field: 'count()'}, {field: 'issue'}, {field: 'title'}],
      };

      const eventView = new EventView(modifiedState);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'issue'}, {field: 'title'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('sorted column occurs at least twice', () => {
      const modifiedState: ConstructorParameters<typeof EventView>[0] = {
        ...state,
        fields: [...state.fields, state.fields[0]!],
      };

      const eventView = new EventView(modifiedState);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        fields: [state.fields[1], state.fields[0]],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('ensures there is at one auto-width column on deletion', () => {
      const modifiedState: ConstructorParameters<typeof EventView>[0] = {
        ...state,
        fields: [
          {field: 'id', width: 75},
          {field: 'title', width: 100},
          {field: 'project', width: 80},
          {field: 'environment', width: 99},
        ],
      };

      const eventView = new EventView(modifiedState);
      let updated = eventView.withDeletedColumn(0, meta);
      let updatedFields = [
        {field: 'title', width: -1},
        {field: 'project', width: 80},
        {field: 'environment', width: 99},
      ];
      expect(updated.fields).toEqual(updatedFields);

      updated = updated.withDeletedColumn(0, meta);
      updatedFields = [
        {field: 'project', width: -1},
        {field: 'environment', width: 99},
      ];
      expect(updated.fields).toEqual(updatedFields);
    });
  });
});

describe('EventView.getSorts()', () => {
  it('returns fields', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: generateSorts([AggregationKey.COUNT]),
      project: [],
    });

    expect(eventView.getSorts()).toEqual([
      {
        key: AggregationKey.COUNT,
        order: 'desc',
      },
    ]);
  });
});

describe('EventView.getQuery()', () => {
  it('with query', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [],
      sorts: [],
      project: [],
      query: 'event.type:error',
    });

    expect(eventView.getQuery()).toBe('event.type:error');
    expect(eventView.getQuery(null)).toBe('event.type:error');
    expect(eventView.getQuery('hello')).toBe('event.type:error hello');
    expect(eventView.getQuery(['event.type:error', 'hello'])).toBe(
      'event.type:error hello'
    );
  });

  it('without query', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [],
      sorts: [],
      project: [],
    });

    expect(eventView.getQuery()).toBe('');
    expect(eventView.getQuery(null)).toBe('');
    expect(eventView.getQuery('hello')).toBe('hello');
    expect(eventView.getQuery(['event.type:error', 'hello'])).toBe(
      'event.type:error hello'
    );
  });
});

describe('EventView.getQueryWithAdditionalConditions', () => {
  it('with overlapping conditions', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [],
      sorts: [],
      project: [],
      query: 'event.type:transaction foo:bar',
    });

    eventView.additionalConditions.setFilterValues('event.type', ['transaction']);

    expect(eventView.getQueryWithAdditionalConditions()).toBe(
      'event.type:transaction foo:bar'
    );
  });
});

describe('EventView.sortForField()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };
  const eventView = new EventView(state);
  const meta: MetaType = {count: 'integer'};

  it('returns the sort when selected field is sorted', () => {
    const field = {
      field: 'count()',
    };

    const actual = eventView.sortForField(field, meta);

    expect(actual).toEqual({
      field: AggregationKey.COUNT,
      kind: 'desc',
    });
  });

  it('returns undefined when selected field is not sorted', () => {
    const field = {
      field: 'issue',
    };

    expect(eventView.sortForField(field, meta)).toBeUndefined();
  });

  it('returns undefined when no meta is provided', () => {
    const field = {
      field: 'issue',
    };

    expect(eventView.sortForField(field, undefined)).toBeUndefined();
  });
});

describe('EventView.sortOnField()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta: MetaType = {count: 'integer', title: 'string'};

  it('returns itself when attempting to sort on un-sortable field', () => {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[1]!;

    const eventView2 = eventView.sortOnField(field, meta);
    expect(eventView2 === eventView).toBe(true);
  });

  it('reverses the sorted field', () => {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[0]!;

    const eventView2 = eventView.sortOnField(field, meta);

    expect(eventView2 !== eventView).toBe(true);

    const nextState = {
      ...state,
      sorts: [{field: AggregationKey.COUNT, kind: 'asc'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('enforce sort order on sorted field', () => {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[0]!;

    const eventView2 = eventView.sortOnField(field, meta, 'asc');
    expect(eventView2).toMatchObject({
      ...state,
      sorts: [{field: AggregationKey.COUNT, kind: 'asc'}],
    });

    const eventView3 = eventView.sortOnField(field, meta, 'desc');
    expect(eventView3).toMatchObject({
      ...state,
      sorts: [{field: AggregationKey.COUNT, kind: 'desc'}],
    });
  });

  it('supports function format on equation sorts', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
      fields: [{field: 'count()'}, {field: 'equation|count() + 100'}],
      sorts: [{field: 'equation|count() + 100', kind: 'desc'}],
    };

    const eventView = new EventView(modifiedState);
    expect(eventView).toMatchObject(modifiedState);
  });

  it('supports index format on equation sorts', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
      fields: [{field: 'count()'}, {field: 'equation|count() + 100'}],
      sorts: [{field: 'equation[0]', kind: 'desc'}],
    };

    const eventView = new EventView(modifiedState);
    expect(eventView).toMatchObject(modifiedState);
  });

  it('sort on new field', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
      fields: [...state.fields, {field: 'title'}],
    };

    const eventView = new EventView(modifiedState);
    expect(eventView).toMatchObject(modifiedState);

    const field = modifiedState.fields[2]!;

    const eventView2 = eventView.sortOnField(field, meta);

    expect(eventView2 !== eventView).toBe(true);

    const nextState = {
      ...modifiedState,
      sorts: [{field: 'title', kind: 'desc'}],
    };

    expect(eventView2).toMatchObject(nextState);

    // enforce asc sort order

    const eventView3 = eventView.sortOnField(field, meta, 'asc');

    expect(eventView3).toMatchObject({
      ...modifiedState,
      sorts: [{field: 'title', kind: 'asc'}],
    });

    // enforce desc sort order

    const eventView4 = eventView.sortOnField(field, meta, 'desc');

    expect(eventView4).toMatchObject({
      ...modifiedState,
      sorts: [{field: 'title', kind: 'desc'}],
    });
  });

  it('sorts on a field using function format', () => {
    const modifiedState: ConstructorParameters<typeof EventView>[0] = {
      ...state,
      fields: [...state.fields, {field: 'count()'}],
    };

    const eventView = new EventView(modifiedState);
    expect(eventView).toMatchObject(modifiedState);

    const field = modifiedState.fields[2]!;

    let sortedEventView = eventView.sortOnField(field, meta, undefined, true);
    expect(sortedEventView.sorts).toEqual([{field: 'count()', kind: 'asc'}]);
    sortedEventView = sortedEventView.sortOnField(field, meta, undefined, true);
    expect(sortedEventView.sorts).toEqual([{field: 'count()', kind: 'desc'}]);
  });
});

describe('EventView.withSorts()', () => {
  it('returns a clone', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'event.type'}],
    });
    const updated = eventView.withSorts([{kind: 'desc', field: 'event.type'}]);
    expect(updated.sorts).not.toEqual(eventView.sorts);
  });

  it('only accepts sorting on fields in the view', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'event.type'}],
    });
    const updated = eventView.withSorts([
      {kind: 'desc', field: 'event.type'},
      {kind: 'asc', field: 'unknown'},
    ]);
    expect(updated.sorts).toEqual([{kind: 'desc', field: 'event.type'}]);
  });

  it('accepts aggregate field sorts', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'p50()'}],
    });
    const updated = eventView.withSorts([
      {kind: 'desc', field: 'p50'},
      {kind: 'asc', field: 'unknown'},
    ]);
    expect(updated.sorts).toEqual([{kind: 'desc', field: 'p50'}]);
  });
});

describe('EventView.isEqualTo()', () => {
  it('should be true when equal', () => {
    const state: ConstructorParameters<typeof EventView>[0] = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'fam',
      display: 'releases',
      dataset: DiscoverDatasets.DISCOVER,
    };

    const eventView = new EventView(state);
    const eventView2 = new EventView(state);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);
    expect(eventView2).toMatchObject(state);
    expect(eventView.isEqualTo(eventView2)).toBe(true);

    // commutativity property holds
    expect(eventView2.isEqualTo(eventView)).toBe(true);
  });

  it('should be true when datetime are equal but differ in format', () => {
    const state: ConstructorParameters<typeof EventView>[0] = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-20T21:02:51+0000',
      end: '2019-10-23T19:27:04+0000',
      environment: ['staging'],
    };

    const eventView = new EventView(state);
    const eventView2 = new EventView({
      ...state,
      start: '2019-10-20T21:02:51Z',
      end: '2019-10-23T19:27:04Z',
    });

    expect(eventView.isEqualTo(eventView2)).toBe(true);
  });

  it('should be false when not equal', () => {
    const state: ConstructorParameters<typeof EventView>[0] = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'fam',
      display: 'releases',
      dataset: DiscoverDatasets.DISCOVER,
    };

    const differences = {
      id: '12',
      name: 'new query',
      fields: [{field: 'issue'}, {field: 'count()'}],
      sorts: [{field: AggregationKey.COUNT, kind: 'asc'}],
      query: 'event.type:transaction',
      project: [24],
      start: '2019-09-01T00:00:00',
      end: '2020-09-01T00:00:00',
      statsPeriod: '24d',
      environment: [],
      yAxis: 'ok boomer',
      display: 'previous',
      dataset: DiscoverDatasets.ISSUE_PLATFORM,
    };
    const eventView = new EventView(state);

    for (const key in differences) {
      const eventView2 = new EventView({
        ...state,
        [key]: differences[key as keyof typeof differences],
      });
      expect(eventView.isEqualTo(eventView2)).toBe(false);
    }
  });

  it('undefined display type equals default display type', () => {
    const state: ConstructorParameters<typeof EventView>[0] = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'issue'}],
      sorts: generateSorts([AggregationKey.COUNT]),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'fam',
    };
    const eventView = new EventView(state);
    const eventView2 = new EventView({...state, display: 'default'});
    expect(eventView.isEqualTo(eventView2)).toBe(true);
  });
});

describe('EventView.getResultsViewUrlTarget()', () => {
  let configState: Config;

  beforeEach(() => {
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
    display: 'previous',
    dataset: DiscoverDatasets.DISCOVER,
  };
  const organization = OrganizationFixture();

  it('generates a URL with non-customer domain context', () => {
    ConfigStore.set('customerDomain', null);
    const view = new EventView(state);
    const result = view.getResultsViewUrlTarget(organization);
    expect(result.pathname).toBe('/organizations/org-slug/explore/discover/results/');
    expect(result.query.query).toEqual(state.query);
    expect(result.query.project).toBe('42');
    expect(result.query.display).toEqual(state.display);
  });

  it('generates a URL with customer domain context', () => {
    const view = new EventView(state);
    const result = view.getResultsViewUrlTarget(organization);
    expect(result.pathname).toBe('/explore/discover/results/');
    expect(result.query.query).toEqual(state.query);
    expect(result.query.project).toBe('42');
    expect(result.query.display).toEqual(state.display);
  });
});

describe('EventView.getResultsViewShortUrlTarget()', () => {
  let configState: Config;

  beforeEach(() => {
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
    display: 'previous',
    dataset: DiscoverDatasets.DISCOVER,
  };
  const organization = OrganizationFixture();

  it('generates a URL with non-customer domain context', () => {
    ConfigStore.set('customerDomain', null);

    const view = new EventView(state);
    const result = view.getResultsViewShortUrlTarget(organization);
    expect(result.pathname).toBe('/organizations/org-slug/explore/discover/results/');
    expect(result.query).not.toHaveProperty('name');
    expect(result.query).not.toHaveProperty('fields');
    expect(result.query).not.toHaveProperty('query');
    expect(result.query.id).toEqual(state.id);
    expect(result.query.statsPeriod).toEqual(state.statsPeriod);
    expect(result.query.project).toBe('42');
    expect(result.query.environment).toBe('staging');
  });

  it('generates a URL with customer domain context', () => {
    const view = new EventView(state);
    const result = view.getResultsViewShortUrlTarget(organization);
    expect(result.pathname).toBe('/explore/discover/results/');
    expect(result.query).not.toHaveProperty('name');
    expect(result.query).not.toHaveProperty('fields');
    expect(result.query).not.toHaveProperty('query');
    expect(result.query.id).toEqual(state.id);
    expect(result.query.statsPeriod).toEqual(state.statsPeriod);
    expect(result.query.project).toBe('42');
    expect(result.query.environment).toBe('staging');
  });
});

describe('EventView.getPerformanceTransactionEventsViewUrlTarget()', () => {
  let configState: Config;

  beforeEach(() => {
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
    display: 'previous',
    dataset: DiscoverDatasets.DISCOVER,
  };
  const organization = OrganizationFixture();
  const showTransactions = EventsDisplayFilterName.P99;
  const breakdown = SpanOperationBreakdownFilter.HTTP;
  const webVital = WebVital.LCP;

  it('generates a URL with non-customer domain context', () => {
    ConfigStore.set('customerDomain', null);
    const view = new EventView(state);
    const result = view.getPerformanceTransactionEventsViewUrlTarget(organization, {
      showTransactions,
      breakdown,
      webVital,
    });
    expect(result.pathname).toBe('/organizations/org-slug/insights/summary/events/');
    expect(result.query.query).toEqual(state.query);
    expect(result.query.project).toBe('42');
    expect(result.query.sort).toBe('-count');
    expect(result.query.transaction).toEqual(state.name);
    expect(result.query.showTransactions).toEqual(showTransactions);
    expect(result.query.breakdown).toEqual(breakdown);
    expect(result.query.webVital).toEqual(webVital);
  });

  it('generates a URL with customer domain context', () => {
    const view = new EventView(state);
    const result = view.getPerformanceTransactionEventsViewUrlTarget(organization, {
      showTransactions,
      breakdown,
      webVital,
    });
    expect(result.pathname).toBe('/insights/summary/events/');
    expect(result.query.query).toEqual(state.query);
    expect(result.query.project).toBe('42');
    expect(result.query.sort).toBe('-count');
    expect(result.query.transaction).toEqual(state.name);
    expect(result.query.showTransactions).toEqual(showTransactions);
    expect(result.query.breakdown).toEqual(breakdown);
    expect(result.query.webVital).toEqual(webVital);
  });
});

describe('EventView.getPageFilters()', () => {
  it('return default global selection', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
    });

    expect(eventView.getPageFilters()).toMatchObject({
      projects: [],
      environments: [],
      datetime: {
        start: null,
        end: null,
        period: null,

        // event views currently do not support the utc option,
        // see comment in EventView.getPageFilters
        utc: true,
      },
    });
  });

  it('returns global selection query', () => {
    const state2 = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      project: [42],
      start: 'start',
      end: 'end',
      statsPeriod: '42d',
      environment: ['prod'],
    };

    const eventView = new EventView(state2);

    expect(eventView.getPageFilters()).toMatchObject({
      projects: state2.project,
      environments: state2.environment,
      datetime: {
        start: state2.start,
        end: state2.end,
        period: state2.statsPeriod,

        // event views currently do not support the utc option,
        // see comment in EventView.getPageFilters
        utc: true,
      },
    });
  });
});

describe('EventView.getPageFiltersQuery()', () => {
  it('return default global selection query', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
    });

    expect(eventView.getPageFiltersQuery()).toMatchObject({
      project: [],
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: [],

      // event views currently do not support the utc option,
      // see comment in EventView.getPageFilters
      utc: 'true',
    });
  });

  it('returns global selection query', () => {
    const state2 = {
      ...REQUIRED_CONSTRUCTOR_PROPS,
      project: [42],
      start: 'start',
      end: 'end',
      statsPeriod: '42d',
      environment: ['prod'],
    };

    const eventView = new EventView(state2);

    expect(eventView.getPageFiltersQuery()).toEqual({
      end: 'end',
      start: 'start',
      statsPeriod: '42d',
      environment: ['prod'],
      project: ['42'],
      utc: 'true',
    });
  });
});

describe('EventView.generateBlankQueryStringObject()', () => {
  it('should return blank values', () => {
    const eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
    });

    expect(eventView.generateBlankQueryStringObject()).toEqual({
      id: undefined,
      name: undefined,
      fields: undefined,
      sorts: undefined,
      query: undefined,
      project: undefined,
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: undefined,
      yAxis: undefined,
      cursor: undefined,
    });
  });
});

describe('EventView.getYAxisOptions()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  function generateYaxis(value: any) {
    return {
      value,
      label: value,
    };
  }

  it('should return default options', () => {
    const thisEventView = new EventView(state);

    expect(thisEventView.getYAxisOptions()).toEqual(CHART_AXIS_OPTIONS);
  });

  it('should add aggregate fields as options', () => {
    let thisEventView = new EventView({
      ...state,
      fields: generateFields(['ignored-field', 'count_unique(issue)']),
    });

    expect(thisEventView.getYAxisOptions()).toEqual([
      generateYaxis('count_unique(issue)'),
      ...CHART_AXIS_OPTIONS,
    ]);

    // should de-duplicate entries
    thisEventView = new EventView({
      ...state,
      fields: generateFields(['ignored-field', 'count()']),
    });

    expect(thisEventView.getYAxisOptions()).toEqual([...CHART_AXIS_OPTIONS]);
  });

  it('should exclude yAxis options that are not useful', () => {
    const thisEventView = new EventView({
      ...state,
      fields: generateFields([
        'ignored-field',
        'count_unique(issue)',
        'last_seen()',
        'max(timestamp)',
      ]),
    });

    expect(thisEventView.getYAxisOptions()).toEqual([
      generateYaxis('count_unique(issue)'),
      ...CHART_AXIS_OPTIONS,
    ]);
  });
});

describe('EventView.getYAxis()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('should return first default yAxis', () => {
    const thisEventView = new EventView(state);

    expect(thisEventView.getYAxis()).toBe('count()');
  });

  it('should return valid yAxis', () => {
    const thisEventView = new EventView({
      ...state,
      fields: generateFields(['ignored-field', 'count_unique(user)', 'last_seen']),
      yAxis: 'count_unique(user)',
    });

    expect(thisEventView.getYAxis()).toBe('count_unique(user)');
  });

  it('should ignore invalid yAxis', () => {
    const invalid = [
      'last_seen',
      'latest_event',
      'count_unique(issue)', // this is not one of the selected fields
    ];

    for (const option of invalid) {
      const thisEventView = new EventView({
        ...state,
        fields: generateFields(['ignored-field', 'last_seen', 'latest_event']),
        yAxis: option,
      });

      // yAxis defaults to the first entry of the default yAxis options
      expect(thisEventView.getYAxis()).toBe('count()');
    }
  });
});

describe('EventView.getDisplayOptions()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('should return default options', () => {
    const eventView = new EventView({
      ...state,
      // there needs to exist an aggregate or TOP 5 modes will be disabled
      fields: [{field: 'count()'}],
    });

    expect(eventView.getDisplayOptions()).toEqual(DISPLAY_MODE_OPTIONS);
  });

  it('should disable previous when start/end are used.', () => {
    const eventView = new EventView({
      ...state,
      end: '2020-04-13T12:13:14',
      start: '2020-04-01T12:13:14',
    });

    const options = eventView.getDisplayOptions();
    expect(options[1]!.value).toBe('previous');
    expect(options[1]!.disabled).toBeTruthy();
  });

  it('should disable top 5 period/daily if no aggregates present', () => {
    const eventView = new EventView({
      ...state,
    });

    const options = eventView.getDisplayOptions();
    expect(options[2]!.value).toBe('top5');
    expect(options[2]!.disabled).toBeTruthy();
    expect(options[4]!.value).toBe('dailytop5');
    expect(options[4]!.disabled).toBeTruthy();
  });
});

describe('EventView.getDisplayMode()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('should have default', () => {
    const eventView = new EventView({
      ...state,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('should return current mode when not disabled', () => {
    const eventView = new EventView({
      ...state,
      display: DisplayModes.DAILY,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DAILY);
  });

  it('should return default mode when disabled', () => {
    const eventView = new EventView({
      ...state,
      // the existence of start and end will disable the PREVIOUS mode
      end: '2020-04-13T12:13:14',
      start: '2020-04-01T12:13:14',
      display: DisplayModes.PREVIOUS,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('top 5 should fallback to default when disabled', () => {
    const eventView = new EventView({
      ...state,
      // the lack of an aggregate will disable the TOP5 mode
      display: DisplayModes.TOP5,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('top 5 daily should fallback to daily when disabled', () => {
    const eventView = new EventView({
      ...state,
      // the lack of an aggregate will disable the DAILYTOP5 mode
      display: DisplayModes.DAILYTOP5,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DAILY);
  });

  it('daily mode should fall back to default when disabled', () => {
    const eventView = new EventView({
      ...state,
      // the period being less than 24h will disable the DAILY mode
      statsPeriod: '1h',
      display: DisplayModes.DAILY,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('top 5 daily mode should fall back to default when daily is disabled', () => {
    const eventView = new EventView({
      ...state,
      // the period being less than 24h will disable the DAILY mode
      statsPeriod: undefined,
      start: '2020-04-01T12:13:14',
      end: '2020-04-02T12:10:14',
      display: DisplayModes.DAILYTOP5,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });
});

describe('EventView.getAggregateFields()', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    fields: [
      {field: 'title'},
      {field: 'count()'},
      {field: 'count_unique(user)'},
      {field: 'apdex(300)'},
      {field: 'transaction'},
    ],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('getAggregateFields() returns only aggregates', () => {
    const eventView = new EventView(state);
    const expected = [
      {field: 'count()'},
      {field: 'count_unique(user)'},
      {field: 'apdex(300)'},
    ];

    expect(eventView.getAggregateFields()).toEqual(expected);
  });
});

describe('EventView.hasAggregateField', () => {
  it('ensures an eventview has an aggregate field', () => {
    let eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'foobar'}],
      sorts: [],
      query: '',
      project: [],
      environment: [],
    });

    expect(eventView.hasAggregateField()).toBe(false);

    eventView = new EventView({
      ...REQUIRED_CONSTRUCTOR_PROPS,
      fields: [{field: 'count(foo.bar.is-Enterprise_42)'}],
      sorts: [],
      query: '',
      project: [],
      environment: [],
    });

    expect(eventView.hasAggregateField()).toBe(true);
  });
});

describe('isAPIPayloadSimilar', () => {
  const state: ConstructorParameters<typeof EventView>[0] = {
    ...REQUIRED_CONSTRUCTOR_PROPS,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'issue'}],
    sorts: generateSorts([AggregationKey.COUNT]),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta: MetaType = {
    count: 'integer',
    title: 'string',
  };

  describe('getEventsAPIPayload', () => {
    it('is not similar when relevant query string keys are present in the Location object', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture({
        query: {
          project: 'project',
          environment: 'environment',
          start: 'start',
          end: 'end',
          utc: 'utc',
          statsPeriod: 'statsPeriod',
          cursor: 'cursor',
        },
      });
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherLocation = LocationFixture();
      const otherAPIPayload = thisEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when irrelevant query string keys are present in the Location object', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture({
        query: {
          bestCountry: 'canada',
        },
      });
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherLocation = LocationFixture();
      const otherAPIPayload = thisEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar on sort key sorted in opposite directions', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.sortOnField({field: 'count()'}, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a new column is added', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = new EventView({
        ...state,
        fields: [...state.fields, {field: 'title', width: COL_WIDTH_UNDEFINED}],
      });
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is updated with no changes', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn: Column = {
        kind: 'function',
        function: [AggregationKey.COUNT, '', undefined, undefined],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is updated with a replaced field', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn: Column = {
        kind: 'field',
        field: 'title',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a column is updated with a replaced aggregation', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn: Column = {
        kind: 'function',
        function: [AggregationKey.AVG, '', undefined, undefined],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is renamed', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn: Column = {
        kind: 'function',
        function: [AggregationKey.COUNT, '', undefined, undefined],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is deleted', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.withDeletedColumn(0, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar if column order changes', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = new EventView({...state, fields: shuffle(state.fields)});
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is similar if equation order relatively same', () => {
      const equationField = {field: 'equation|failure_count() / count()'};
      const otherEquationField = {field: 'equation|failure_count() / 2'};
      state.fields = [
        {field: 'issue'},
        {field: 'count()'},
        equationField,
        otherEquationField,
      ];
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      state.fields = [
        equationField,
        {field: 'issue'},
        {field: 'count()'},
        otherEquationField,
      ];
      const otherEventView = new EventView(state);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar if equation order changes', () => {
      const equationField = {field: 'equation|failure_count() / count()'};
      const otherEquationField = {field: 'equation|failure_count() / 2'};
      state.fields = [
        {field: 'issue'},
        {field: 'count()'},
        equationField,
        otherEquationField,
      ];
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      state.fields = [
        {field: 'issue'},
        {field: 'count()'},
        otherEquationField,
        equationField,
      ];
      const otherEventView = new EventView(state);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });
  });

  describe('getFacetsAPIPayload', () => {
    it('only includes relevant parameters', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const results = thisEventView.getFacetsAPIPayload(location);
      const expected = {
        query: state.query,
        project: ['42'],
        statsPeriod: state.statsPeriod,
        environment: state.environment,
      };

      expect(results).toEqual(expected);
    });

    it('is similar on sort key sorted in opposite directions', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getFacetsAPIPayload(location);

      const newColumn: Column = {
        kind: 'function',
        function: [AggregationKey.COUNT, '', undefined, undefined],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getFacetsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
      expect(results).toBe(true);
    });

    it('is similar when a columns are different', () => {
      const thisEventView = new EventView(state);
      const location = LocationFixture();
      const thisAPIPayload = thisEventView.getFacetsAPIPayload(location);

      const otherEventView = new EventView({
        ...state,
        fields: [...state.fields, {field: 'title', width: COL_WIDTH_UNDEFINED}],
      });
      const otherLocation = LocationFixture();
      const otherAPIPayload = otherEventView.getFacetsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
      expect(results).toBe(true);
    });
  });
});

describe('pickRelevantLocationQueryStrings', () => {
  it('picks relevant query strings', () => {
    const location = LocationFixture({
      query: {
        project: 'project',
        environment: 'environment',
        start: 'start',
        end: 'end',
        utc: 'utc',
        statsPeriod: 'statsPeriod',
        cursor: 'cursor',

        // irrelevant query strings
        bestCountry: 'canada',
      },
    });

    const actual = pickRelevantLocationQueryStrings(location);

    const expected = {
      start: 'start',
      end: 'end',
      utc: 'utc',
      statsPeriod: 'statsPeriod',
      cursor: 'cursor',
    };

    expect(actual).toEqual(expected);
  });
});
