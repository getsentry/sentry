import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';

interface DetectorSubtitleProps {
  environment: string;
  projectId: string;
}

export function DetectorSubtitle({projectId, environment}: DetectorSubtitleProps) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);
  return (
    <Flex gap={space(1)} align="center">
      {project && (
        <Flex gap={space(1)} align="center">
          <ProjectAvatar project={project} title={project.slug} />
          <span>{project.slug}</span>
        </Flex>
      )}
      <div aria-hidden>|</div>
      <div>{environment || t('All Environments')}</div>
    </Flex>
  );
}
