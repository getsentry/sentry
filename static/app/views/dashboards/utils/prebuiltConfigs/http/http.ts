import {t} from 'sentry/locale';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  PERCENTAGE_3XX,
  PERCENTAGE_4XX,
  PERCENTAGE_5XX,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/constants';
import {
  AVERAGE_DURATION_TEXT,
  BASE_FILTERS,
  DASHBOARD_TITLE,
  RESPONSE_CODES_TEXT,
  THROUGHPUT_TEXT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/settings';
import {
  FIELD_ALIASES,
  TABLE_MIN_HEIGHT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const FILTER_STRING = MutableSearch.fromQueryObject(BASE_FILTERS).formatString();

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'throughput-chart',
      title: THROUGHPUT_TEXT,
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: THROUGHPUT_TEXT,
          conditions: FILTER_STRING,
          fields: ['epm()'],
          aggregates: ['epm()'],
          columns: [],
          orderby: 'epm()',
        },
      ],
    },
    {
      id: 'duration-chart',
      title: AVERAGE_DURATION_TEXT,
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: AVERAGE_DURATION_TEXT,
          conditions: FILTER_STRING,
          fields: [`avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [],
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'response-codes-chart',
      title: RESPONSE_CODES_TEXT,
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: FILTER_STRING,
          fields: [PERCENTAGE_3XX, PERCENTAGE_4XX, PERCENTAGE_5XX],
          aggregates: [PERCENTAGE_3XX, PERCENTAGE_4XX, PERCENTAGE_5XX],
          columns: [],
          orderby: PERCENTAGE_3XX,
        },
      ],
    },
  ],
  0
);

const DOMAIN_TABLE: Widget = {
  id: 'domain-table',
  title: t('Domains'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      aggregates: [
        'epm()',
        PERCENTAGE_3XX,
        PERCENTAGE_4XX,
        PERCENTAGE_5XX,
        `avg(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.SPAN_DOMAIN, SpanFields.PROJECT],
      fields: [
        SpanFields.SPAN_DOMAIN,
        SpanFields.PROJECT,
        'epm()',
        PERCENTAGE_3XX,
        PERCENTAGE_4XX,
        PERCENTAGE_5XX,
        `avg(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      fieldAliases: [
        t('Domain'),
        FIELD_ALIASES.project,
        `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
        t('3XXs'),
        t('4XXs'),
        t('5XXs'),
        DataTitles.avg,
        DataTitles.timeSpent,
      ],
      linkedDashboards: [
        {
          dashboardId: '-1',
          field: SpanFields.SPAN_DOMAIN,
          staticDashboardId: 5,
        },
      ],
      conditions: FILTER_STRING,
      name: '',
      orderby: `-sum(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 2,
    minH: TABLE_MIN_HEIGHT,
    h: 4,
    w: 6,
  },
};

export const HTTP_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.USER_GEO_SUBREGION,
          name: SpanFields.USER_GEO_SUBREGION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.SPAN_DOMAIN,
          name: SpanFields.SPAN_DOMAIN,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [...FIRST_ROW_WIDGETS, DOMAIN_TABLE],
  onboarding: {type: 'module', moduleName: ModuleName.HTTP},
};
