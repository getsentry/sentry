import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';

import {useDistribution} from './utils/useDistribution';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

type Props = {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

export function SamplingFromOtherProject({orgSlug, projectSlug}: Props) {
  const {distribution, loading} = useDistribution();

  const {projects} = useProjects({
    slugs: distribution?.parentProjectBreakdown?.map(({project}) => project) ?? [],
    orgId: orgSlug,
  });

  const otherProjects = projects.filter(project => project.slug !== projectSlug);

  if (loading || otherProjects.length === 0) {
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
      {tn(
        'The following project made sampling decisions for this project. You might want to set up rules there.',
        'The following projects made sampling decisions for this project. You might want to set up rules there.',
        otherProjects.length
      )}
      <Projects>
        {otherProjects.map(project => (
          <ProjectBadge
            key={project.slug}
            project={project}
            avatarSize={16}
            to={`/settings/${orgSlug}/projects/${project.slug}/dynamic-sampling/`}
          />
        ))}
      </Projects>
    </Alert>
  );
}

const Projects = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1.5)};
  justify-content: flex-start;
  align-items: center;
  margin-top: ${space(1)};
`;
