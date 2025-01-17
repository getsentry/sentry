import {useMemo} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import Panel from 'sentry/components/panels/panel';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {
  backend,
  frontend,
  mobile,
  PlatformCategory,
  serverless,
} from 'sentry/data/platformCategories';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {
  newExploreTarget,
  type SuggestedQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {ToolbarHeader, ToolbarHeaderButton, ToolbarLabel, ToolbarSection} from './styles';

interface ToolbarSuggestedQueriesProps {}

export function ToolbarSuggestedQueries(props: ToolbarSuggestedQueriesProps) {
  const organization = useOrganization();

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:metrics-empty-state-dismissed`,
    expirationDays: 30,
  });

  if (isDismissed) {
    return null;
  }

  return <ToolbarSuggestedQueriesInner {...props} dismiss={dismiss} />;
}

interface ToolbarSuggestedQueriesInnerProps extends ToolbarSuggestedQueriesProps {
  dismiss: () => void;
}

function ToolbarSuggestedQueriesInner({dismiss}: ToolbarSuggestedQueriesInnerProps) {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  const suggestedQueries: SuggestedQuery[] = useMemo(() => {
    const counters = {
      [PlatformCategory.FRONTEND]: 0,
      [PlatformCategory.MOBILE]: 0,
      [PlatformCategory.BACKEND]: 0,
    };

    for (const project of getSelectedProjectsList(selection.projects, projects)) {
      if (!defined(project.platform)) {
        continue;
      }
      if (frontend.includes(project.platform)) {
        counters[PlatformCategory.FRONTEND] += 1;
      } else if (mobile.includes(project.platform)) {
        counters[PlatformCategory.MOBILE] += 1;
      } else if (backend.includes(project.platform)) {
        counters[PlatformCategory.BACKEND] += 1;
      } else if (serverless.includes(project.platform)) {
        // consider serverless as a type of backend platform
        counters[PlatformCategory.BACKEND] += 1;
      }
    }

    const platforms = [
      PlatformCategory.FRONTEND,
      PlatformCategory.MOBILE,
      PlatformCategory.BACKEND,
    ]
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      .filter(k => counters[k] > 0)
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      .sort((a, b) => counters[b] - counters[a]);

    return getSuggestedQueries(platforms);
  }, [selection, projects]);

  return (
    <ToolbarSection data-test-id="section-suggested-queries">
      <StyledPanel>
        <ToolbarHeader>
          <ToolbarLabel underlined={false}>{t('Suggested Queries')}</ToolbarLabel>
          <ToolbarHeaderButton
            size="zero"
            onClick={dismiss}
            borderless
            aria-label={t('Dismiss Suggested Queries')}
            icon={<IconClose />}
          />
        </ToolbarHeader>
        <div>
          {t("Feeling like a newb? Been there, done that. Here's a few to get you goin.")}
        </div>
        <SuggestedQueriesContainer>
          {suggestedQueries.map(suggestedQuery => (
            <SuggestedQueryLink
              key={suggestedQuery.title}
              suggestedQuery={suggestedQuery}
            />
          ))}
        </SuggestedQueriesContainer>
      </StyledPanel>
    </ToolbarSection>
  );
}

interface SuggestedQueryLinkProps {
  suggestedQuery: SuggestedQuery;
}

function SuggestedQueryLink({suggestedQuery}: SuggestedQueryLinkProps) {
  const location = useLocation();
  const target = useMemo(
    () => newExploreTarget(location, suggestedQuery),
    [location, suggestedQuery]
  );

  return (
    <Tag to={target} icon={null} type="info">
      {suggestedQuery.title}
    </Tag>
  );
}

function getSelectedProjectsList(
  selectedProjects: PageFilters['projects'],
  projects: Project[]
): Project[] {
  if (
    selectedProjects[0] === ALL_ACCESS_PROJECTS || // all projects
    selectedProjects.length === 0 // my projects
  ) {
    return projects;
  }

  const projectIds = new Set(selectedProjects.map(String));

  return projects.filter(project => projectIds.has(project.id));
}

function getSuggestedQueries(platforms: PlatformCategory[], maxQueries = 5) {
  const frontendQueries: SuggestedQuery[] = [
    {
      title: t('Worst LCPs'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'measurements.lcp',
      ],
      groupBys: ['span.description'],
      mode: Mode.AGGREGATE,
      query: 'span.op:[pageload,navigation]',
      sortBys: [{field: 'avg(measurements.lcp)', kind: 'desc'}],
      visualizes: [
        {chartType: ChartType.LINE, yAxes: ['p50(measurements.lcp)']},
        {chartType: ChartType.LINE, yAxes: ['avg(measurements.lcp)']},
      ],
    },
    {
      title: t('Biggest Assets'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'http.response_transfer_size',
        'timestamp',
      ],
      groupBys: ['span.description'],
      mode: Mode.AGGREGATE,
      query: 'span.op:[resource.css,resource.img,resource.script]',
      sortBys: [{field: 'p75(http.response_transfer_size)', kind: 'desc'}],
      visualizes: [
        {chartType: ChartType.LINE, yAxes: ['p75(http.response_transfer_size)']},
        {chartType: ChartType.LINE, yAxes: ['p90(http.response_transfer_size)']},
      ],
    },
    {
      title: t('Top Pageloads'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'timestamp',
      ],
      groupBys: ['span.description'],
      mode: Mode.AGGREGATE,
      query: 'span.op:[pageload,navigation]',
      sortBys: [{field: 'avg(span.duration)', kind: 'desc'}],
      visualizes: [
        {chartType: ChartType.LINE, yAxes: ['avg(span.duration)']},
        {chartType: ChartType.LINE, yAxes: ['p50(span.duration)']},
      ],
    },
  ];

  const backendQueries: SuggestedQuery[] = [
    {
      title: t('Slowest Server Calls'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'timestamp',
      ],
      groupBys: ['span.description'],
      mode: Mode.AGGREGATE,
      query: 'span.op:http.server',
      sortBys: [{field: 'p75(span.duration)', kind: 'desc'}],
      visualizes: [
        {chartType: ChartType.LINE, yAxes: ['p75(span.duration)']},
        {chartType: ChartType.LINE, yAxes: ['p90(span.duration)']},
      ],
    },
  ];

  const mobileQueries: SuggestedQuery[] = [
    {
      title: t('Top Screenloads'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'timestamp',
      ],
      groupBys: ['span.description'],
      mode: Mode.AGGREGATE,
      query: 'span.op:ui.load',
      sortBys: [{field: 'count(span.duration)', kind: 'desc'}],
      visualizes: [{chartType: ChartType.LINE, yAxes: ['count(span.duration)']}],
    },
  ];

  const allQueries: Partial<Record<PlatformCategory, SuggestedQuery[]>> = {
    [PlatformCategory.FRONTEND]: frontendQueries,
    [PlatformCategory.BACKEND]: backendQueries,
    [PlatformCategory.MOBILE]: mobileQueries,
  };

  const genericQueries: SuggestedQuery[] = [
    {
      title: t('Slowest Ops'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'timestamp',
      ],
      groupBys: ['span.op'],
      mode: Mode.AGGREGATE,
      query: '',
      sortBys: [{field: 'avg(span.duration)', kind: 'desc'}],
      visualizes: [
        {chartType: ChartType.LINE, yAxes: ['avg(span.duration)']},
        {chartType: ChartType.LINE, yAxes: ['p50(span.duration)']},
      ],
    },
    {
      title: t('Database Latency'),
      fields: [
        'id',
        'project',
        'span.op',
        'span.description',
        'span.duration',
        'db.system',
      ],
      groupBys: ['span.op', 'db.system'],
      mode: Mode.AGGREGATE,
      query: 'span.op:db',
      sortBys: [{field: 'avg(span.duration)', kind: 'desc'}],
      visualizes: [
        {chartType: ChartType.LINE, yAxes: ['avg(span.duration)']},
        {chartType: ChartType.LINE, yAxes: ['p50(span.duration)']},
      ],
    },
  ];

  const queries: SuggestedQuery[] = [];

  for (const platform of platforms) {
    for (const query of allQueries[platform] || []) {
      queries.push(query);
      if (queries.length >= maxQueries) {
        return queries;
      }
    }
  }

  for (const query of genericQueries) {
    queries.push(query);
    if (queries.length >= maxQueries) {
      return queries;
    }
  }

  return queries;
}

const StyledPanel = styled(Panel)`
  padding: ${space(2)};
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
`;

const SuggestedQueriesContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;
