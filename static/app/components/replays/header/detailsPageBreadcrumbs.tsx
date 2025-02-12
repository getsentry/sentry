import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: ReplayRecord | undefined;
};

function DetailsPageBreadcrumbs({replayRecord}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);

  const {projects} = useProjects();
  const project = projects.find(p => p.id === replayRecord?.project_id);

  const labelTitle = replayRecord ? (
    <Fragment>{getShortEventId(replayRecord?.id)}</Fragment>
  ) : (
    <Placeholder width="100%" height="16px" />
  );

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: {
            pathname: makeReplaysPathname({
              path: '/',
              organization,
            }),
            query: eventView.generateQueryStringObject(),
          },
          label: t('Session Replay'),
        },
        {
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
        },
        {
          label: labelTitle,
        },
      ]}
    />
  );
}

export default DetailsPageBreadcrumbs;
