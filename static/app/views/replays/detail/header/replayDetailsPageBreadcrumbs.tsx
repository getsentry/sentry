import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsPageBreadcrumbs({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const project = useProjectFromId({project_id: replayRecord?.project_id ?? undefined});

  const listPageCrumb = {
    to: {
      pathname: makeReplaysPathname({
        path: '/',
        organization,
      }),
      query: eventView.generateQueryStringObject(),
    },
    label: t('Session Replay'),
  };

  const projectCrumb = {
    to: {
      pathname: makeReplaysPathname({
        path: '/',
        organization,
      }),
      query: {
        ...eventView.generateQueryStringObject(),
        project: replayRecord?.project_id,
      },
    },
    label: project ? (
      <ProjectBadge disableLink project={project} avatarSize={16} />
    ) : null,
  };

  const replayCrumb = {
    label: replayRecord ? (
      <Fragment>{getShortEventId(replayRecord?.id)}</Fragment>
    ) : (
      <Placeholder width="100%" height="16px" />
    ),
  };

  const crumbs = [
    listPageCrumb,
    project ? projectCrumb : null,
    replayRecord ? replayCrumb : null,
  ].filter(defined);

  return <Breadcrumbs crumbs={crumbs} />;
}
