import {Fragment} from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  isVideoReplay: boolean | undefined;
  orgSlug: string;
  replayRecord: ReplayRecord | undefined;
};

function DetailsPageBreadcrumbs({orgSlug, replayRecord, isVideoReplay}: Props) {
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
            pathname: normalizeUrl(`/organizations/${orgSlug}/replays/`),
            query: eventView.generateQueryStringObject(),
          },
          label: t('Session Replay'),
        },
        {
          to: {
            pathname: normalizeUrl(`/organizations/${orgSlug}/replays/`),
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
          label: isVideoReplay ? (
            <span>
              {labelTitle}
              <FeatureBadge
                type="beta"
                title={t('Session Replay for mobile apps is currently in beta. Beta features are still in progress and may have bugs.')}
              />
            </span>
          ) : (
            labelTitle
          ),
        },
      ]}
    />
  );
}

export default DetailsPageBreadcrumbs;
