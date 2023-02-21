import {Fragment} from 'react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import Tag, {Background} from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock} from 'sentry/icons';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: ReplayRecord | undefined;
};

function ReplayMetaData({replayRecord}: Props) {
  const {pathname, query} = useLocation();
  const {replaySlug} = useParams();
  const {projects} = useProjects();
  const [slug] = replaySlug.split(':');

  const errorsTabHref = {
    pathname,
    query: {
      ...query,
      t_main: 'console',
      f_c_logLevel: 'issue',
      f_c_search: undefined,
    },
  };

  return (
    <KeyMetrics>
      {replayRecord ? (
        <ProjectBadge
          project={projects.find(p => p.id === replayRecord.project_id) || {slug}}
          avatarSize={16}
        />
      ) : (
        <HeaderPlaceholder />
      )}

      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={replayRecord.started_at} unitStyle="short" />
          </Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <IconClock color="gray300" />
            <Duration
              seconds={Math.trunc(replayRecord?.duration.asSeconds())}
              abbreviation
              exact
            />
          </Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>

      {replayRecord ? (
        <StyledLink to={errorsTabHref}>
          <ErrorTag
            icon={null}
            type={replayRecord.count_errors ? 'error' : 'black'}
            level={replayRecord.count_errors ? 'fatal' : 'default'}
          >
            {replayRecord.count_errors}
          </ErrorTag>
          {tn('Error', 'Errors', replayRecord.count_errors)}
        </StyledLink>
      ) : (
        <HeaderPlaceholder />
      )}
    </KeyMetrics>
  );
}

export const HeaderPlaceholder = styled(
  (props: React.ComponentProps<typeof Placeholder>) => (
    <Placeholder width="80px" height="19px" {...props} />
  )
)`
  background-color: ${p => p.theme.background};
`;

const KeyMetrics = styled('div')`
  display: flex;
  gap: ${space(3)};
  align-items: center;
  justify-content: end;
  font-size: ${p => p.theme.fontSizeMedium};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    justify-content: start;
  }
`;

const KeyMetricData = styled('div')`
  color: ${p => p.theme.textColor};
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

const ErrorTag = styled(Tag)<{level: 'fatal' | 'default'}>`
  ${Background} {
    background: ${p => p.theme.level[p.level]};
    border-color: ${p => p.theme.level[p.level]};
    padding: 0 ${space(0.75)};

    span {
      color: ${p => p.theme.buttonCountActive} !important;
    }
  }
`;

export default ReplayMetaData;
