import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import countBy from 'lodash/countBy';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Badge} from 'sentry/components/core/badge';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {RawReplayError} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  replayErrors: RawReplayError[];
};

export default function ErrorCounts({replayErrors}: Props) {
  const {pathname, query} = useLocation();

  const getLink = useCallback(
    ({projectSlug}: {projectSlug?: string}) => {
      return {
        pathname,
        query: {...query, t_main: TabKey.ERRORS, f_e_project: projectSlug},
      };
    },
    [pathname, query]
  );

  const {projects} = useProjects();

  const countsPerProject = useMemo(() => {
    const data = Object.entries(countBy(replayErrors, 'project.name'))
      .sort(([, a], [, b]) => b - a)
      .reduce(
        (memo, [projectSlug]) => {
          memo[projectSlug] = {};
          return memo;
        },
        {} as Record<string, Record<string, number>>
      );
    for (const error of replayErrors) {
      const projectSlug = error['project.name'];
      const level = error.level;
      if (!data[projectSlug]!.hasOwnProperty(level)) {
        data[projectSlug]![level] = 0;
      }
      data[projectSlug]![level]!++;
    }
    return data;
  }, [replayErrors]);

  if (!Object.keys(countsPerProject).length) {
    return <Count aria-label={t('number of errors')}>0</Count>;
  }
  if (Object.keys(countsPerProject).length < 3) {
    return (
      <Fragment>
        {Object.entries(countsPerProject).map(([projectSlug, counts]) => (
          <Tooltip
            key={projectSlug}
            title={
              <ColumnTooltipContent>
                <dt>{projectSlug}</dt>
                <dd>
                  {Object.entries(counts)
                    .map(([level, count]) => `${level}: ${count}`)
                    .join(', ')}
                </dd>
              </ColumnTooltipContent>
            }
          >
            <StyledLink to={getLink({projectSlug})}>
              <ProjectAvatar
                size={16}
                project={
                  projects.find(p => p.slug === projectSlug) ?? {slug: projectSlug}
                }
              />
              <ErrorCount aria-label={t('number of errors')}>
                {Object.values(counts).reduce((a, b) => a + b, 0)}
              </ErrorCount>
            </StyledLink>
          </Tooltip>
        ))}
      </Fragment>
    );
  }

  const extraProjectCount = Object.keys(countsPerProject).length - 2;
  const totalErrors = replayErrors.length;
  return (
    <Tooltip
      title={
        <ColumnTooltipContent>
          {Object.entries(countsPerProject).map(([projectSlug, counts]) => (
            <Fragment key={projectSlug}>
              <dt>{projectSlug}</dt>
              <dd>
                {Object.entries(counts)
                  .map(([level, count]) => `${level}: ${count}`)
                  .join(', ')}
              </dd>
            </Fragment>
          ))}
        </ColumnTooltipContent>
      }
    >
      <StyledLink to={getLink({})}>
        <StackedProjectBadges>
          {Object.keys(countsPerProject)
            .slice(0, 2)
            .map(projectSlug => {
              return (
                <ProjectAvatar
                  key={projectSlug}
                  size={16}
                  project={
                    projects.find(p => p.slug === projectSlug) ?? {slug: projectSlug}
                  }
                />
              );
            })}
          <Badge aria-label={t('hidden projects')} variant="muted">
            +{extraProjectCount}
          </Badge>
        </StackedProjectBadges>
        <ErrorCount aria-label={t('total errors')}>{totalErrors}</ErrorCount>
      </StyledLink>
    </Tooltip>
  );
}

const Count = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const ErrorCount = styled(Count)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ColumnTooltipContent = styled(CountTooltipContent)`
  grid-template-columns: max-content max-content;
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  align-items: center;
  & * {
    cursor: pointer !important;
  }
`;

const StackedProjectBadges = styled('div')`
  display: flex;
  align-items: center;
  & * {
    margin-left: 0;
    margin-right: 0;
    cursor: pointer !important;
  }

  & *:hover {
    z-index: unset;
  }

  & > :not(:first-child) {
    margin-left: -${space(0.5)};
  }
`;
