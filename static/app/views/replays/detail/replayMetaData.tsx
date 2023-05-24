import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import countBy from 'lodash/countBy';

import Badge from 'sentry/components/badge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import ContextIcon from 'sentry/components/replays/contextIcon';
import ErrorCount from 'sentry/components/replays/header/errorCount';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord | undefined;
};

function ReplayMetaData({replayRecord, replayErrors}: Props) {
  const {pathname, query} = useLocation();
  const {projects} = useProjects();

  const errorsTabHref = {
    pathname,
    query: {
      ...query,
      t_main: 'console',
      f_c_logLevel: 'issue',
      f_c_search: undefined,
    },
  };

  const errorCountByProject = useMemo(
    () =>
      Object.entries(countBy(replayErrors, 'project.name'))
        .map(([projectSlug, count]) => ({
          project: projects.find(p => p.slug === projectSlug),
          count,
        }))
        // sort to prioritize the replay errors first
        .sort(a => (a.project?.id !== replayRecord?.project_id ? 1 : -1)),
    [replayErrors, projects, replayRecord]
  );

  return (
    <KeyMetrics>
      <KeyMetricLabel>{t('OS')}</KeyMetricLabel>
      <KeyMetricData>
        <ContextIcon
          name={replayRecord?.os.name ?? ''}
          version={replayRecord?.os.version ?? undefined}
        />
      </KeyMetricData>

      <KeyMetricLabel>{t('Browser')}</KeyMetricLabel>
      <KeyMetricData>
        <ContextIcon
          name={replayRecord?.browser.name ?? ''}
          version={replayRecord?.browser.version ?? undefined}
        />
      </KeyMetricData>

      <KeyMetricLabel>{t('Start Time')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={replayRecord.started_at} unitStyle="regular" />
          </Fragment>
        ) : (
          <HeaderPlaceholder width="80px" height="16px" />
        )}
      </KeyMetricData>
      <KeyMetricLabel>{t('Errors')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <StyledLink to={errorsTabHref}>
            {errorCountByProject.length > 0 ? (
              <Fragment>
                {errorCountByProject.length < 3 ? (
                  errorCountByProject.map(({project, count}, idx) => (
                    <ErrorCount key={idx} countErrors={count} project={project} />
                  ))
                ) : (
                  <StackedErrorCount errorCounts={errorCountByProject} />
                )}
              </Fragment>
            ) : (
              <ErrorCount countErrors={0} />
            )}
          </StyledLink>
        ) : (
          <HeaderPlaceholder width="80px" height="16px" />
        )}
      </KeyMetricData>
    </KeyMetrics>
  );
}

function StackedErrorCount({
  errorCounts,
}: {
  errorCounts: Array<{count: number; project: Project | undefined}>;
}) {
  const projectCount = errorCounts.length - 2;
  const totalErrors = errorCounts.reduce((acc, val) => acc + val.count, 0);
  return (
    <Fragment>
      <StackedProjectBadges>
        {errorCounts.slice(0, 2).map((v, idx) => {
          if (!v.project) {
            return null;
          }

          return <ProjectBadge key={idx} project={v.project} hideName disableLink />;
        })}
        <Badge>+{projectCount}</Badge>
      </StackedProjectBadges>
      <ErrorCount countErrors={totalErrors} hideIcon />
    </Fragment>
  );
}

const StackedProjectBadges = styled('div')`
  display: flex;
  align-items: center;
  & * {
    margin-left: 0;
    margin-right: 0;
    cursor: pointer;
  }

  & *:hover {
    z-index: unset;
  }

  & > :not(:first-child) {
    margin-left: -${space(0.5)};
  }
`;

const KeyMetrics = styled('dl')`
  display: grid;
  grid-template-rows: max-content 1fr;
  grid-template-columns: repeat(4, max-content);
  grid-auto-flow: column;
  gap: 0 ${space(3)};
  align-items: center;
  align-self: end;
  color: ${p => p.theme.gray300};
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    justify-self: flex-end;
  }
`;

const KeyMetricLabel = styled('dt')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const KeyMetricData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const StyledLink = styled(Link)`
  display: flex;
  gap: ${space(1)};
`;

export default ReplayMetaData;
