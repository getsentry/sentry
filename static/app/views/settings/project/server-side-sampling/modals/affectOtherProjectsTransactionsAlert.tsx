import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';

import {SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';

import {Projects} from './uniformRateModal';

type Props = {
  affectedProjects: Project[];
  isProjectIncompatible: boolean;
  /**
   * Slug of current project's page
   */
  projectSlug: Project['slug'];
};

export function AffectOtherProjectsTransactionsAlert({
  isProjectIncompatible,
  affectedProjects,
  projectSlug,
}: Props) {
  if (
    affectedProjects.length === 0 ||
    isProjectIncompatible ||
    (affectedProjects.length === 1 && affectedProjects[0].slug === projectSlug)
  ) {
    return null;
  }

  return (
    <Alert
      type="info"
      showIcon
      trailingItems={
        <Button
          href={`${SERVER_SIDE_SAMPLING_DOC_LINK}#traces--propagation-of-sampling-decisions`}
          priority="link"
          borderless
          external
        >
          {t('Learn More')}
        </Button>
      }
    >
      {t('This rate will affect the transactions for the following projects:')}
      <Projects>
        {affectedProjects.map(affectedProject => (
          <ProjectBadge
            key={affectedProject.id}
            project={affectedProject}
            avatarSize={16}
          />
        ))}
      </Projects>
    </Alert>
  );
}
