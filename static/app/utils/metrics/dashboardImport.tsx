import {Client} from 'sentry/api';
import type {MetricMeta, MRI} from 'sentry/types';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import type {Widget} from 'sentry/views/dashboards/types';

// import types
export type ImportDashboard = {
  description: string;
  title: string;
  widgets: ImportWidget[];
};

export type ImportWidget = {
  definition: WidgetDefinition;
  id: number;
};

type WidgetDefinition = {
  query: string;
  title: string;
  type: string;
  widgets: ImportWidget[];
  legend_columns?: ('avg' | 'max' | 'min' | 'sum' | 'value')[];
  requests?: Request[];
};

type Request = {
  display_type: 'area' | 'bars' | 'line';
  formulas: Formula[];
  queries: {
    data_source: string;
    name: string;
    query: string;
  }[];
  response_format: 'note' | 'timeseries';
  style?: {
    line_type: 'dotted' | 'solid';
  };
};

type Formula = {
  formula: string;
  alias?: string;
};

type MetricWidgetReport = {
  errors: string[];
  id: number;
  outcome: ImportOutcome;
  title: string;
}[];

type ImportOutcome = 'success' | 'warning' | 'error';

export type ParseResult = {
  description: string;
  report: MetricWidgetReport;
  title: string;
  widgets: Widget[];
};

export async function parseDashboard(
  dashboard: ImportDashboard,
  availableMetrics: MetricMeta[]
): Promise<ParseResult> {
  const {widgets = []} = dashboard;

  const flatWidgets = widgets.flatMap(widget => {
    if (widget.definition.type === 'group') {
      return widget.definition.widgets;
    }

    return [widget];
  });

  const results = await Promise.all(
    flatWidgets.map(widget => {
      const parser = new WidgetParser(widget, availableMetrics);
      return parser.parse();
    })
  );

  return {
    title: dashboard.title,
    description: dashboard.description,
    widgets: results.map(r => r.widget).filter(Boolean) as Widget[],
    report: results.flatMap(r => r.report),
  };
}

const SUPPORTED_COLUMNS = new Set(['avg', 'max', 'min', 'sum', 'value']);
const SUPPORTED_WIDGET_TYPES = new Set(['timeseries']);

const METRIC_SUFFIX_TO_OP = {
  avg: 'avg',
  max: 'max',
  min: 'min',
  sum: 'sum',
  count: 'count',
  '50percentile': 'p50',
  '75percentile': 'p75',
  '90percentile': 'p90',
  '95percentile': 'p95',
  '99percentile': 'p99',
};

export class WidgetParser {
  private errors: string[] = [];
  private api = new Client();
  private importedWidget: ImportWidget;
  private availableMetrics: MetricMeta[];

  constructor(importedWidget: ImportWidget, availableMetrics: MetricMeta[]) {
    this.importedWidget = importedWidget;
    this.availableMetrics = availableMetrics;
  }

  // Parsing functions
  public async parse() {
    const {
      id,
      definition: {title, type: widgetType},
    } = this.importedWidget;

    try {
      if (!SUPPORTED_WIDGET_TYPES.has(widgetType)) {
        throw new Error(`widget - unsupported type ${widgetType}`);
      }
      const widget = await this.parseWidget();

      if (!widget || !widget.queries.length) {
        throw new Error('widget - no parseable queries found');
      }

      const outcome: ImportOutcome = this.errors.length ? 'warning' : 'success';

      return {
        report: {
          id,
          title,
          errors: this.errors,
          outcome,
        },
        widget,
      };
    } catch (e) {
      return {
        report: {
          id,
          title,
          errors: [e.message, ...this.errors],
          outcome: 'error' as const,
        },
        widget: null,
      };
    }
  }

  private async parseWidget() {
    this.parseLegendColumns();

    const {title, requests = []} = this.importedWidget.definition as WidgetDefinition;

    const parsedQueries = requests
      .map(r => this.parseRequest(r))
      .flatMap(request => {
        const {displayType, queries} = request;
        return queries.map(query => ({
          displayType,
          ...query,
        }));
      });

    const metricsQueries = await Promise.all(
      parsedQueries.map(async query => {
        const mapped = await this.mapToMetricsQuery(query);
        return {
          ...mapped,
          displayType: query.displayType,
        };
      })
    );

    const nonEmptyQueries = metricsQueries.filter(query => query.mri) as MetricsQuery[];

    if (!nonEmptyQueries.length) {
      return null;
    }
    return convertToDashboardWidget(nonEmptyQueries, parsedQueries[0].displayType, title);
  }

  private parseLegendColumns() {
    (this.importedWidget.definition?.legend_columns ?? []).forEach(column => {
      if (!SUPPORTED_COLUMNS.has(column)) {
        this.errors.push(`widget - unsupported column: ${column}`);
      }
    });
  }

  private parseRequest(request: Request) {
    const {queries, formulas = [], response_format, display_type} = request;

    const parsedFormulas = formulas.map(f => this.parseFormula(f));

    const parsedQueries = queries
      .filter(q => parsedFormulas.includes(q.name))
      .map(q => this.parseQuery(q));

    if (response_format !== 'timeseries') {
      this.errors.push(
        `widget.request.response_format - unsupported: ${response_format}`
      );
    }

    const displayType = this.parseDisplayType(display_type);

    this.parseStyle(request.style);

    return {
      displayType,
      queries: parsedQueries,
    };
  }

  private parseFormula(formula: Formula) {
    if (!formula.formula.includes('(')) {
      return formula.formula;
    }

    const [functionName, ...args] = formula.formula
      .split(/\(|\)|,/)
      .filter(Boolean)
      .map(s => s.trim());

    this.errors.push(`widget.request.formula - unsupported function ${functionName}`);

    // TODO: check if there are functions with more than 1 argument and if they are supported
    return args[0];
  }

  private parseDisplayType(displayType: string) {
    switch (displayType) {
      case 'area':
        return MetricDisplayType.AREA;
      case 'bars':
        return MetricDisplayType.BAR;
      case 'line':
        return MetricDisplayType.LINE;
      default:
        this.errors.push(
          `widget.request.display_type - unsupported: ${displayType}, assuming line`
        );
        return MetricDisplayType.LINE;
    }
  }

  private parseStyle(style?: Request['style']) {
    if (style?.line_type === 'dotted') {
      this.errors.push(
        `widget.request.style - unsupported line type: ${style.line_type}`
      );
    }
  }

  private parseQuery(query: {query: string}) {
    return this.parseQueryString(query.query);
  }

  private parseQueryString(str: string) {
    const operationMatch = str.match(/^(sum|avg|max|min):/);
    let op = operationMatch ? operationMatch[1] : undefined;

    const metricNameMatch = str.match(/:(\S*){/);
    let metric = metricNameMatch ? metricNameMatch[1] : undefined;

    if (metric?.includes('.')) {
      const lastIndex = metric.lastIndexOf('.');
      const metricName = metric.slice(0, lastIndex);
      const operationSuffix = metric.slice(lastIndex + 1);

      if (METRIC_SUFFIX_TO_OP[operationSuffix]) {
        op = METRIC_SUFFIX_TO_OP[operationSuffix];
        metric = metricName;
      }
    }

    const filtersMatch = str.match(/{([^}]*)}/);
    const filters = filtersMatch ? this.parseFilters(filtersMatch[1]) : [];

    const groupByMatch = str.match(/by {([^}]*)}/);
    const groupBy = groupByMatch ? this.parseGroupByValues(groupByMatch[1]) : [];

    const appliedFunctionMatch = str.match(/\.(\w+)\(\)/);
    const appliedFunction = appliedFunctionMatch ? appliedFunctionMatch[1] : undefined;

    if (!op) {
      this.errors.push(`widget.request.query - could not parse op: ${str}, assuming sum`);
      op = 'sum';
    }

    if (!metric) {
      this.errors.push(
        `widget.request.query - could not parse name: ${str}, assuming ${metric}`
      );
      metric = 'sentry.event_manager.save';
    }

    // TODO: check which other functions are supported
    if (appliedFunction) {
      if (appliedFunction === 'as_count') {
        op = 'sum';
        this.errors.push(
          `widget.request.query - unsupported function ${appliedFunction}, assuming sum`
        );
      } else {
        this.errors.push(
          `widget.request.query - unsupported function ${appliedFunction}`
        );
      }
    }

    return {
      op,
      metric,
      filters,
      groupBy,
      appliedFunction,
    };
  }

  // Helper functions
  private parseFilters(filtersString) {
    const filters: any[] = [];
    const pairs = filtersString.split(',');

    for (const pair of pairs) {
      const [key, value] = pair.split(':');
      if (!key || !value) {
        continue;
      }
      if (value.includes('*')) {
        const stripped = value.replace(/\*/g, '');
        this.errors.push(
          `widget.request.query.filter - unsupported value: ${value}, using ${stripped}`
        );
        if (stripped) {
          filters.push({key: key.trim(), value: stripped.trim()});
        }
        continue;
      }

      filters.push({key: key.trim(), value: value.trim()});
    }

    return filters;
  }

  private parseGroupByValues(groupByString) {
    return groupByString.split(',').map(value => value.trim());
  }

  // Mapping functions
  private async mapToMetricsQuery(widget): Promise<MetricsQuery | null> {
    const {metric, op, filters} = widget;

    // @ts-expect-error name is actually defined on MetricMeta
    const metricMeta = this.availableMetrics.find(m => m.name === metric);

    if (!metricMeta) {
      this.errors.push(`widget.request.query - metric not found: ${metric}`);
      return null;
    }

    const availableTags = await this.fetchAvailableTags(metricMeta.mri);

    const query = this.constructMetricQueryFilter(filters, availableTags);
    const groupBy = this.constructMetricGroupBy(widget.groupBy, availableTags);

    return {
      mri: metricMeta.mri,
      op,
      query,
      groupBy,
    };
  }

  private async fetchAvailableTags(mri: MRI) {
    const tagsRes = await this.api.requestPromise(`/organizations/sentry/metrics/tags/`, {
      query: {
        metric: mri,
        useCase: 'custom',
      },
    });

    return (tagsRes ?? []).map(tag => tag.key);
  }

  private constructMetricQueryFilter(
    filters: {key: string; value: string}[],
    availableTags: string[]
  ) {
    const queryFilters = filters.map(filter => {
      const {key, value} = filter;

      if (!availableTags.includes(key)) {
        this.errors.push(`widget.request.query - unsupported filter: ${key}`);
        return null;
      }
      return `${key}:${value}`;
    });

    return queryFilters.filter(Boolean).join(' ');
  }

  private constructMetricGroupBy(groupBy: string[], availableTags: string[]): string[] {
    return groupBy.filter(group => {
      if (!availableTags.includes(group)) {
        this.errors.push(`widget.request.query - unsupported group by: ${group}`);
        return false;
      }
      return true;
    });
  }
}
