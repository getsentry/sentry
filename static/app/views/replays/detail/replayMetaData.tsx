import {Fragment} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import Tag, {Background} from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';
import {useRouteContext} from 'sentry/utils/useRouteContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: ReplayRecord | undefined;
};

function ReplayMetaData({replayRecord}: Props) {
  const {
    location: {pathname, query},
    params: {replaySlug},
  } = useRouteContext();
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
          project={projects.find(p => p.id === replayRecord.projectId) || {slug}}
          avatarSize={16}
        />
      ) : (
        <HeaderPlaceholder />
      )}

      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={replayRecord.startedAt} shorten />
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
      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <ErrorTag to={errorsTabHref} icon={null} type="error">
              {replayRecord?.countErrors}
            </ErrorTag>
            <Link to={errorsTabHref}>{t('Errors')}</Link>
          </Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
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
  display: grid;
  gap: ${space(3)};
  grid-template-columns: repeat(4, max-content);
  align-items: center;
  justify-content: end;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const KeyMetricData = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(1)};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const ErrorTag = styled(Tag)`
  ${Background} {
    background: ${p => p.theme.tag.error.iconColor};
    padding: 0 ${space(0.75)};

    span {
      color: white !important;
    }
  }
`;

export default ReplayMetaData;
