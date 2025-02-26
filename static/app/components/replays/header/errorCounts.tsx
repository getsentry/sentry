import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Badge} from 'sentry/components/core/badge';
import Link from 'sentry/components/links/link';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import useErrorCountPerProject from 'sentry/components/replays/header/useErrorCountPerProject';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord;
};

export default function ErrorCounts({replayErrors, replayRecord}: Props) {
  const {pathname, query} = useLocation();

  const getLink = useCallback(
    ({project}: {project?: Project}) => {
      return {
        pathname,
        query: {...query, t_main: TabKey.ERRORS, f_e_project: project?.slug},
      };
    },
    [pathname, query]
  );

  const errorCountPerProject = useErrorCountPerProject({replayErrors, replayRecord});

  if (!errorCountPerProject.length) {
    return <Count aria-label={t('number of errors')}>0</Count>;
  }
  if (errorCountPerProject.length < 3) {
    return (
      <Fragment>
        {errorCountPerProject.map(({project, count}) =>
          project ? (
            <Tooltip
              key={project.slug}
              title={
                <CountTooltipContent>
                  <dt>{t('Project:')}</dt>
                  <dd>{project.slug}</dd>
                  <dt>{t('Errors:')}</dt>
                  <dd>{count}</dd>
                </CountTooltipContent>
              }
            >
              <StyledLink to={getLink({project})}>
                <ProjectAvatar size={16} project={project} />
                <ErrorCount aria-label={t('number of errors')}>{count}</ErrorCount>
              </StyledLink>
            </Tooltip>
          ) : null
        )}
      </Fragment>
    );
  }

  const extraProjectCount = errorCountPerProject.length - 2;
  const totalErrors = errorCountPerProject.reduce((acc, val) => acc + val.count, 0);
  return (
    <Tooltip
      title={
        <ColumnTooltipContent>
          {errorCountPerProject.map(({project, count}) => (
            <Fragment key={project?.slug}>
              <dt>{project?.slug}</dt>
              <dd>{tn('1 error', '%s errors', count)}</dd>
            </Fragment>
          ))}
        </ColumnTooltipContent>
      }
    >
      <StyledLink to={getLink({})}>
        <StackedProjectBadges>
          {errorCountPerProject.slice(0, 2).map(({project}) => {
            return project ? (
              <ProjectAvatar key={project.slug} size={16} project={project} />
            ) : (
              <IconFire />
            );
          })}
          <Badge aria-label={t('hidden projects')} type="default">
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
  color: ${p => p.theme.gray300};
`;

const ColumnTooltipContent = styled(CountTooltipContent)`
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr 1fr;
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
