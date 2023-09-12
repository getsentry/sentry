import {Fragment} from 'react';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {getShortEventId} from 'sentry/utils/events';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/types';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  feedback: undefined | HydratedFeedbackItem;
  organization: Organization;
}

export default function FeedbackHeader({feedback, organization}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === feedback?.project_id);

  const labelTitle = feedback ? (
    <Fragment>{getShortEventId(feedback?.id)}</Fragment>
  ) : (
    <HeaderPlaceholder width="100%" height="16px" />
  );

  return (
    <Breadcrumbs
      crumbs={[
        {
          to: {
            pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
          },
          label: t('Feedback'),
        },
        {
          label: (
            <Fragment>
              {project ? (
                <ProjectBadge disableLink project={project} avatarSize={16} />
              ) : null}
            </Fragment>
          ),
        },
        {
          label: labelTitle,
        },
      ]}
    />
  );
}
