import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import CountTooltipContent from 'sentry/components/replays/header/countTooltipContent';
import useErrorCountPerProject from 'sentry/components/replays/header/useErrorCountPerProject';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord;
};

export default function ErrorCounts({replayErrors, replayRecord}: Props) {
  const {pathname, query} = useLocation();
  const organization = useOrganization();
  const hasErrorTab = organization.features.includes('session-replay-errors-tab');

  const getLink = useCallback(
    ({project}: {project?: Project}) => {
      return hasErrorTab
        ? {
            pathname,
            query: {...query, t_main: 'errors', f_e_project: project?.slug},
          }
        : {
            pathname,
            query: {
              ...query,
              t_main: 'console',
              f_c_logLevel: 'issue',
              f_c_search: undefined,
            },
          };
    },
    [hasErrorTab, pathname, query]
  );
  const errorCountPerProject = useErrorCountPerProject({replayErrors, replayRecord});

  if (!errorCountPerProject.length) {
    return <Count>0</Count>;
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
                <ProjectBadge avatarSize={16} disableLink hideName project={project} />
                <ErrorCount>{count}</ErrorCount>
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
      forceVisible
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
              <ProjectBadge
                avatarSize={16}
                disableLink
                hideName
                key={project.slug}
                project={project}
              />
            ) : (
              <IconFire />
            );
          })}
          <Badge>+{extraProjectCount}</Badge>
        </StackedProjectBadges>
        <ErrorCount>{totalErrors}</ErrorCount>
      </StyledLink>
    </Tooltip>
  );
}

const Count = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const ErrorCount = styled(Count)`
  color: ${p => p.theme.red400};
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
