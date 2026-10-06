import {t, tn} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';
import type {Project} from 'sentry/types/project';
import {WidgetType, type DashboardListItem} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export type DashboardDataSource = 'errors' | 'spans' | 'logs' | 'metrics' | 'releases';

export interface LandingDashboard {
  dataSources: Set<DashboardDataSource>;
  id: string;
  isFavorited: boolean;
  projects: number[];
  /**
   * Stand-in for "how many members of the org starred this". The dashboards
   * list endpoint only tells us whether the *current* user starred a
   * dashboard, so this demo derives a stable fake count from the id.
   */
  starCount: number;
  title: string;
  createdById?: string;
  lastVisited?: string;
  prebuiltId?: PrebuiltDashboardId;
}

interface LandingSectionItem {
  dashboard: LandingDashboard;
  reason?: string;
}

export interface LandingSection {
  description: string;
  items: LandingSectionItem[];
  key: string;
  title: string;
  emptyMessage?: string;
  isDemoData?: boolean;
  platform?: PlatformKey;
  /**
   * Query params for the full dashboards table that best matches this box.
   */
  viewAllQuery?: Record<string, string>;
}

interface Framework {
  key: string;
  keywords: string[];
  label: string;
  matchesPlatform: (platform: string) => boolean;
  platform: PlatformKey;
  prebuiltIds: PrebuiltDashboardId[];
}

const MOBILE_PLATFORM_PREFIXES = [
  'apple',
  'android',
  'react-native',
  'flutter',
  'dart',
  'capacitor',
  'cordova',
  'ionic',
  'unity',
];

// Ordered from most to least specific so that e.g. a Next.js project is not
// only reported as a generic browser JavaScript project.
const FRAMEWORKS: Framework[] = [
  {
    key: 'nextjs',
    label: 'Next.js',
    platform: 'javascript-nextjs',
    matchesPlatform: p => p === 'javascript-nextjs',
    keywords: ['next.js', 'nextjs'],
    prebuiltIds: [
      PrebuiltDashboardId.NEXTJS_FRONTEND_OVERVIEW,
      PrebuiltDashboardId.WEB_VITALS,
    ],
  },
  {
    key: 'laravel',
    label: 'Laravel',
    platform: 'php-laravel',
    matchesPlatform: p => p === 'php-laravel',
    keywords: ['laravel'],
    prebuiltIds: [
      PrebuiltDashboardId.LARAVEL_OVERVIEW,
      PrebuiltDashboardId.BACKEND_QUEUES,
    ],
  },
  {
    key: 'node',
    label: 'Node.js',
    platform: 'node',
    matchesPlatform: p => p === 'node' || p.startsWith('node-'),
    keywords: ['node', 'express', 'nest'],
    prebuiltIds: [
      PrebuiltDashboardId.NODE_RUNTIME_METRICS,
      PrebuiltDashboardId.BACKEND_OVERVIEW,
      PrebuiltDashboardId.HTTP,
    ],
  },
  {
    key: 'python',
    label: 'Python',
    platform: 'python',
    matchesPlatform: p => p === 'python' || p.startsWith('python-'),
    keywords: ['python', 'django', 'flask', 'fastapi', 'celery'],
    prebuiltIds: [
      PrebuiltDashboardId.BACKEND_OVERVIEW,
      PrebuiltDashboardId.BACKEND_QUERIES,
      PrebuiltDashboardId.BACKEND_CACHES,
      PrebuiltDashboardId.BACKEND_QUEUES,
    ],
  },
  {
    key: 'mobile',
    label: t('Mobile'),
    platform: 'apple-ios',
    matchesPlatform: p => MOBILE_PLATFORM_PREFIXES.some(prefix => p.startsWith(prefix)),
    keywords: ['mobile', 'ios', 'android', 'app start', 'screen'],
    prebuiltIds: [
      PrebuiltDashboardId.MOBILE_VITALS,
      PrebuiltDashboardId.MOBILE_SESSION_HEALTH,
    ],
  },
  {
    key: 'browser',
    label: t('Browser JavaScript'),
    platform: 'javascript',
    matchesPlatform: p =>
      (p === 'javascript' || p.startsWith('javascript-')) && p !== 'javascript-nextjs',
    keywords: ['frontend', 'browser', 'web vitals', 'react', 'vue', 'angular'],
    prebuiltIds: [
      PrebuiltDashboardId.FRONTEND_OVERVIEW,
      PrebuiltDashboardId.WEB_VITALS,
      PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
      PrebuiltDashboardId.FRONTEND_ASSETS,
    ],
  },
];

const WIDGET_TYPE_TO_DATA_SOURCE: Partial<Record<WidgetType, DashboardDataSource>> = {
  [WidgetType.DISCOVER]: 'errors',
  [WidgetType.ERRORS]: 'errors',
  [WidgetType.ISSUE]: 'errors',
  [WidgetType.SPANS]: 'spans',
  [WidgetType.TRANSACTIONS]: 'spans',
  [WidgetType.LOGS]: 'logs',
  [WidgetType.TRACEMETRICS]: 'metrics',
  [WidgetType.METRICS]: 'metrics',
  [WidgetType.RELEASE]: 'releases',
};

// Used only when we have no widget-level information for a custom dashboard.
const TITLE_KEYWORDS: Record<DashboardDataSource, string[]> = {
  errors: ['error', 'issue', 'crash', 'exception', 'bug'],
  spans: [
    'span',
    'performance',
    'latency',
    'trace',
    'transaction',
    'vitals',
    'query',
    'queries',
    'http',
    'api',
    'endpoint',
    'p95',
    'duration',
    'cache',
    'queue',
  ],
  logs: ['log'],
  metrics: ['metric', 'runtime', 'memory', 'cpu'],
  releases: ['release', 'session', 'adoption', 'crash free'],
};

export const DATA_SOURCE_LABELS: Record<DashboardDataSource, string> = {
  errors: t('Errors'),
  spans: t('Spans'),
  logs: t('Logs'),
  metrics: t('Metrics'),
  releases: t('Releases'),
};

function getDataSourcesFromWidgetTypes(
  widgetTypes: Array<WidgetType | undefined>
): Set<DashboardDataSource> {
  const sources = new Set<DashboardDataSource>();
  for (const widgetType of widgetTypes) {
    const source = widgetType ? WIDGET_TYPE_TO_DATA_SOURCE[widgetType] : undefined;
    if (source) {
      sources.add(source);
    }
  }
  return sources;
}

export function getDataSourcesFromTitle(title: string): Set<DashboardDataSource> {
  const lowerTitle = title.toLowerCase();
  const sources = new Set<DashboardDataSource>();
  for (const [source, keywords] of Object.entries(TITLE_KEYWORDS)) {
    if (keywords.some(keyword => lowerTitle.includes(keyword))) {
      sources.add(source as DashboardDataSource);
    }
  }
  return sources;
}

function getMockStarCount(id: string, isFavorited: boolean): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return (hash % 14) + (isFavorited ? 1 : 0);
}

export function toLandingDashboard(
  dashboard: DashboardListItem,
  widgetTypes?: Array<WidgetType | undefined>
): LandingDashboard {
  const prebuiltConfig =
    dashboard.prebuiltId && dashboard.prebuiltId in PREBUILT_DASHBOARDS
      ? PREBUILT_DASHBOARDS[dashboard.prebuiltId]
      : undefined;

  const knownWidgetTypes =
    widgetTypes ?? prebuiltConfig?.widgets.map(widget => widget.widgetType);
  const dataSources = knownWidgetTypes
    ? getDataSourcesFromWidgetTypes(knownWidgetTypes)
    : getDataSourcesFromTitle(dashboard.title);

  return {
    id: dashboard.id,
    title: dashboard.title,
    prebuiltId: dashboard.prebuiltId,
    projects: dashboard.projects ?? [],
    isFavorited: !!dashboard.isFavorited,
    createdById: dashboard.createdBy?.id,
    lastVisited: dashboard.lastVisited,
    dataSources,
    starCount: getMockStarCount(dashboard.id, !!dashboard.isFavorited),
  };
}

export function getProjectFrameworks(projects: Project[]) {
  const counts = new Map<Framework, Project[]>();
  for (const project of projects) {
    const framework = FRAMEWORKS.find(f => f.matchesPlatform(project.platform ?? ''));
    if (framework) {
      counts.set(framework, [...(counts.get(framework) ?? []), project]);
    }
  }
  return Array.from(counts.entries(), ([framework, frameworkProjects]) => ({
    framework,
    projects: frameworkProjects,
  })).sort((a, b) => b.projects.length - a.projects.length);
}

function matchesFramework(
  dashboard: LandingDashboard,
  framework: Framework,
  frameworkProjectIds: Set<number>
) {
  if (dashboard.prebuiltId && framework.prebuiltIds.includes(dashboard.prebuiltId)) {
    return true;
  }
  const lowerTitle = dashboard.title.toLowerCase();
  if (framework.keywords.some(keyword => lowerTitle.includes(keyword))) {
    return true;
  }
  return dashboard.projects.some(id => frameworkProjectIds.has(id));
}

function hasTelemetryFor(dashboard: LandingDashboard, projects: Project[]) {
  const flags = dashboard.prebuiltId
    ? PREBUILT_DASHBOARDS[dashboard.prebuiltId]?.onboarding?.requiredProjectFlags
    : undefined;
  if (!flags?.length) {
    return false;
  }
  return projects.some(project => flags.some(flag => project[flag]));
}

const SECTION_SIZE = 3;

function take(items: LandingSectionItem[], size = SECTION_SIZE) {
  return items.slice(0, size);
}

interface BuildSectionsOptions {
  dashboards: LandingDashboard[];
  mostPopular: LandingDashboard[];
  projects: Project[];
  recentlyViewed: LandingDashboard[];
  userId: string;
  maxFrameworkSections?: number;
}

export function buildLandingSections({
  dashboards,
  mostPopular,
  recentlyViewed,
  projects,
  userId,
  maxFrameworkSections = 2,
}: BuildSectionsOptions): LandingSection[] {
  const projectFrameworks = getProjectFrameworks(projects);
  const memberProjects = projects.filter(project => project.isMember);
  const memberProjectsById = new Map(
    memberProjects.map(project => [Number(project.id), project])
  );

  const recommended = dashboards
    .filter(dashboard => dashboard.prebuiltId)
    .map(dashboard => {
      const framework = projectFrameworks.find(({framework: f}) =>
        f.prebuiltIds.includes(dashboard.prebuiltId!)
      );
      const hasData = hasTelemetryFor(dashboard, projects);
      const score = (framework ? 2 : 0) + (hasData ? 1 : 0) + dashboard.starCount / 100;
      const reason = framework
        ? t('For your %s projects', framework.framework.label)
        : hasData
          ? t('You already send this data')
          : undefined;
      return {dashboard, reason, score};
    })
    .filter(({score}) => score >= 1)
    .sort((a, b) => b.score - a.score);

  const frameworkSections: LandingSection[] = projectFrameworks
    .slice(0, maxFrameworkSections)
    .map(({framework, projects: frameworkProjects}) => {
      const frameworkProjectIds = new Set(frameworkProjects.map(p => Number(p.id)));
      const items = dashboards
        .filter(dashboard => matchesFramework(dashboard, framework, frameworkProjectIds))
        // Prefer the framework's own prebuilt dashboards, then the most starred.
        .sort(
          (a, b) =>
            Number(!!b.prebuiltId) - Number(!!a.prebuiltId) || b.starCount - a.starCount
        )
        .map(dashboard => ({dashboard}));
      return {
        key: `framework-${framework.key}`,
        title: framework.label,
        platform: framework.platform,
        description: tn(
          'Picked for your %s %s project',
          'Picked for your %s %s projects',
          frameworkProjects.length,
          framework.label
        ),
        items: take(items),
        emptyMessage: t('No %s dashboards yet', framework.label),
      };
    });

  const bySource = (source: DashboardDataSource) =>
    dashboards
      .filter(dashboard => dashboard.dataSources.has(source))
      .sort((a, b) => b.starCount - a.starCount)
      .map(dashboard => ({dashboard}));

  const forYourProjects = dashboards
    .filter(dashboard => !dashboard.prebuiltId)
    .flatMap(dashboard => {
      const project = dashboard.projects
        .map(id => memberProjectsById.get(id))
        .find(defined => defined !== undefined);
      return project ? [{dashboard, reason: project.slug}] : [];
    });

  return [
    {
      key: 'starred',
      title: t('Starred'),
      description: t('Dashboards you starred'),
      items: take(
        dashboards
          .filter(dashboard => dashboard.isFavorited)
          .map(dashboard => ({dashboard}))
      ),
      emptyMessage: t('Star a dashboard to pin it here'),
      // The full table always pins starred dashboards to the top.
      viewAllQuery: {},
    },
    {
      key: 'recommended',
      title: t('Recommended for you'),
      description: t('Based on your project platforms and the data you send'),
      items: take(recommended),
      emptyMessage: t('Send some data to get recommendations'),
      viewAllQuery: {filter: 'onlyPrebuilt'},
    },
    ...frameworkSections,
    {
      key: 'most-popular',
      title: t('Most popular in your org'),
      description: t('Visited most often by your teammates'),
      items: take(mostPopular.map(dashboard => ({dashboard}))),
      viewAllQuery: {sort: 'mostPopular'},
    },
    {
      key: 'most-starred',
      title: t('Most starred'),
      description: t('Starred by the most members of your org'),
      isDemoData: true,
      items: take(
        [...dashboards]
          .sort((a, b) => b.starCount - a.starCount)
          .map(dashboard => ({
            dashboard,
            reason: tn('%s star', '%s stars', dashboard.starCount),
          }))
      ),
    },
    {
      key: 'recently-viewed',
      title: t('Recently viewed'),
      description: t('Pick up where you left off'),
      items: take(
        recentlyViewed
          .filter(dashboard => dashboard.lastVisited)
          .map(dashboard => ({dashboard}))
      ),
      emptyMessage: t('Dashboards you open will show up here'),
      viewAllQuery: {sort: 'recentlyViewed'},
    },
    {
      key: 'errors',
      title: t('Errors & issues'),
      description: t('Dashboards built on error events'),
      items: take(bySource('errors')),
    },
    {
      key: 'spans',
      title: t('Performance & spans'),
      description: t('Latency, throughput and tracing data'),
      items: take(bySource('spans')),
    },
    {
      key: 'logs-metrics',
      title: t('Logs & metrics'),
      description: t('Dashboards built on logs and application metrics'),
      items: take(
        dashboards
          .filter(
            dashboard =>
              dashboard.dataSources.has('logs') || dashboard.dataSources.has('metrics')
          )
          .map(dashboard => ({dashboard}))
      ),
    },
    {
      key: 'your-projects',
      title: t('For your projects'),
      description: t('Custom dashboards scoped to projects you belong to'),
      items: take(forYourProjects),
      emptyMessage: t('No dashboards are scoped to your projects yet'),
    },
    {
      key: 'created-by-you',
      title: t('Created by you'),
      description: t('Dashboards you own'),
      items: take(
        dashboards
          .filter(dashboard => dashboard.createdById === userId)
          .map(dashboard => ({dashboard}))
      ),
      emptyMessage: t("You haven't created any dashboards yet"),
      viewAllQuery: {sort: 'mydashboards'},
    },
  ];
}
