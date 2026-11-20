import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t, tn} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

import type {ServiceAccount} from './types';

const MAX_PROJECT_BADGES = 3;

function useAccountProjects(account: ServiceAccount) {
  const {projects} = useProjects();
  return projects.filter(project => account.projectIds.includes(project.id));
}

export function ProjectAccessSummary({account}: {account: ServiceAccount}) {
  const accountProjects = useAccountProjects(account);
  if (account.allProjects) {
    return <Text>{t('All projects')}</Text>;
  }
  const projectCount = account.projectIds.length;
  if (projectCount === 0) {
    return <Text>{t('No projects')}</Text>;
  }
  // Fall back to a count when some IDs aren't in the store, so the slugs
  // never undercount the projects the account can reach.
  if (projectCount <= 2 && accountProjects.length === projectCount) {
    return (
      <Text ellipsis>{accountProjects.map(project => project.slug).join(', ')}</Text>
    );
  }
  return <Text>{tn('%s project', '%s projects', projectCount)}</Text>;
}

export function ProjectAccessBadges({account}: {account: ServiceAccount}) {
  const accountProjects = useAccountProjects(account);
  if (account.allProjects) {
    return <Text>{t('All projects')}</Text>;
  }
  const projectCount = account.projectIds.length;
  if (projectCount === 0) {
    return <Text variant="muted">{t('No projects')}</Text>;
  }
  const shown = accountProjects.slice(0, MAX_PROJECT_BADGES);
  if (shown.length === 0) {
    return <Text>{tn('%s project', '%s projects', projectCount)}</Text>;
  }
  const hiddenCount = projectCount - shown.length;
  const hiddenSlugs = accountProjects
    .slice(MAX_PROJECT_BADGES)
    .map(project => project.slug);
  return (
    <Flex wrap="wrap" gap="sm md" align="center">
      {shown.map(project => (
        <ProjectBadge key={project.id} project={project} avatarSize={16} />
      ))}
      {hiddenCount > 0 &&
        (hiddenSlugs.length > 0 ? (
          <InfoText title={hiddenSlugs.join(', ')}>{t('+%s more', hiddenCount)}</InfoText>
        ) : (
          <Text>{t('+%s more', hiddenCount)}</Text>
        ))}
    </Flex>
  );
}
