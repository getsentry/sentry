import {Client} from 'sentry/api';
import {getQuerySymbol} from 'sentry/components/metrics/querySymbol';
import type {MetricMeta, MRI} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
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
  availableMetrics: MetricMeta[],
  organization: Organization
): Promise<ParseResult> {
  const metricsNewInputs = hasMetricsNewInputs(organization);
  const {widgets = []} = dashboard;

  const flatWidgets = widgets.flatMap(widget => {
    if (widget.definition.type === 'group') {
      return widget.definition.widgets;
    }

    return [widget];
  });

  const results = await Promise.all(
    flatWidgets.map(widget => {
      const parser = new WidgetParser(
        widget,
        availableMetrics,
        organization.slug,
        metricsNewInputs
      );
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

const METRIC_SUFFIX_TO_AGGREGATION = {
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
  private orgSlug: string;
  private metricsNewInputs: boolean;

  constructor(
    importedWidget: ImportWidget,
    availableMetrics: MetricMeta[],
    orgSlug: string,
    metricsNewInputs: boolean
  ) {
    this.importedWidget = importedWidget;
    this.availableMetrics = availableMetrics;
    this.orgSlug = orgSlug;
    this.metricsNewInputs = metricsNewInputs;
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

    const parsedRequests = requests.map(r => this.parseRequest(r));
    const parsedQueries = parsedRequests.flatMap(request => request.queries);

    const metricsQueries = await Promise.all(
      parsedQueries.map(async query => {
        const mapped = await this.mapToMetricsQuery(query);
        return {
          ...mapped,
        };
      })
    );

    const nonEmptyQueries = metricsQueries.filter(query => query.mri) as MetricsQuery[];

    if (!nonEmptyQueries.length) {
      return null;
    }

    const metricsEquations = parsedRequests
      .flatMap(request => request.equations)
      .map(equation => this.mapToMetricsEquation(equation.formula));

    return convertToDashboardWidget(
      [...nonEmptyQueries, ...metricsEquations],
      parsedRequests[0]!.displayType,
      title
    );
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

    const parsedQueries = queries
      .map(query => this.parseQuery(query))
      .sort((a, b) => a!.name.localeCompare(b!.name));

    if (response_format !== 'timeseries') {
      this.errors.push(
        `widget.request.response_format - unsupported: ${response_format}`
      );
    }

    const equationFormulas = formulas.filter(f =>
      // indicates a more complex formula and not just a reference to a query
      f.formula.trim().includes(' ')
    );
    const parsedEquations = this.parseEquations(parsedQueries, equationFormulas);

    const displayType = this.parseDisplayType(display_type);

    this.parseStyle(request.style);

    return {
      displayType,
      queries: parsedQueries,
      equations: parsedEquations,
    };
  }

  // swaps query names with query symbols in formulas eg. query1 + $query0 => $b + $a
  private parseEquations(queries: any[], formulas: Formula[]) {
    const queryNames = queries.map(q => q.name);
    const queryNameMap = queries.reduce((acc, query, index) => {
      acc[query.name] = getQuerySymbol(index, this.metricsNewInputs);
      return acc;
    }, {});

    const equations = formulas.map(formula => {
      const {formula: formulaString, alias} = formula;
      const mapped = queryNames.reduce((acc, queryName) => {
        return acc.replaceAll(queryName, `$${queryNameMap[queryName]}`);
      }, formulaString);

      return {
        formula: mapped,
        alias,
      };
    });

    return equations;
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

  private parseQuery(query: {name: string; query: string}) {
    return {...this.parseQueryString(query.query), name: query.name};
  }

  private parseQueryString(str: string) {
    const aggregationMatch = str.match(/^(sum|avg|max|min):/);
    let aggregation = aggregationMatch ? aggregationMatch[1] : undefined;

    const metricNameMatch = str.match(/:(\S*){/);
    let metric = metricNameMatch ? metricNameMatch[1] : undefined;

    if (metric?.includes('.')) {
      const lastIndex = metric.lastIndexOf('.');
      const metricName = metric.slice(0, lastIndex);
      const aggregationSuffix = metric.slice(lastIndex + 1);

      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (METRIC_SUFFIX_TO_AGGREGATION[aggregationSuffix]) {
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        aggregation = METRIC_SUFFIX_TO_AGGREGATION[aggregationSuffix];
        metric = metricName;
      }
    }

    const filtersMatch = str.match(/{([^}]*)}/);
    const filters = filtersMatch ? this.parseFilters(filtersMatch[1]) : [];

    const groupByMatch = str.match(/by {([^}]*)}/);
    const groupBy = groupByMatch ? this.parseGroupByValues(groupByMatch[1]) : [];

    const appliedFunctionMatch = str.match(/\.(\w+)\(\)/);
    const appliedFunction = appliedFunctionMatch ? appliedFunctionMatch[1] : undefined;

    if (!aggregation) {
      this.errors.push(
        `widget.request.query - could not parse aggregation: ${str}, assuming sum`
      );
      aggregation = 'sum';
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
        aggregation = 'sum';
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
      aggregation,
      metric,
      filters,
      groupBy,
      appliedFunction,
    };
  }

  // Helper functions
  private parseFilters(filtersString: any) {
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

  private parseGroupByValues(groupByString: any) {
    return groupByString.split(',').map((value: any) => value.trim());
  }

  // Mapping functions
  private async mapToMetricsQuery(widget: any): Promise<MetricsQuery | null> {
    const {metric, aggregation, filters} = widget;

    // @ts-ignore TS(2339): Property 'name' does not exist on type 'MetricMeta... Remove this comment to see the full error message
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
      aggregation,
      query,
      groupBy,
    };
  }

  private mapToMetricsEquation(formula: string) {
    return {
      type: 'formula',
      formula,
    };
  }

  private async fetchAvailableTags(mri: MRI) {
    const tagsRes = await this.api.requestPromise(
      `/organizations/${this.orgSlug}/metrics/tags/`,
      {
        query: {
          metric: mri,
          useCase: 'custom',
        },
      }
    );

    return (tagsRes ?? []).map((tag: any) => tag.key);
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
