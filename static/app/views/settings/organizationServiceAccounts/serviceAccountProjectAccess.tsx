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
  if (accountProjects.length <= 2) {
    return (
      <Text ellipsis>
        {accountProjects.length === 0
          ? t('No projects')
          : accountProjects.map(project => project.slug).join(', ')}
      </Text>
    );
  }
  return <Text>{tn('%s project', '%s projects', accountProjects.length)}</Text>;
}

export function ProjectAccessBadges({account}: {account: ServiceAccount}) {
  const accountProjects = useAccountProjects(account);
  if (account.allProjects) {
    return <Text>{t('All projects')}</Text>;
  }
  if (accountProjects.length === 0) {
    return <Text variant="muted">{t('No projects')}</Text>;
  }
  const hidden = accountProjects.slice(MAX_PROJECT_BADGES);
  return (
    <Flex wrap="wrap" gap="sm md" align="center">
      {accountProjects.slice(0, MAX_PROJECT_BADGES).map(project => (
        <ProjectBadge key={project.id} project={project} avatarSize={16} />
      ))}
      {hidden.length > 0 && (
        <InfoText title={hidden.map(project => project.slug).join(', ')}>
          {t('+%s more', hidden.length)}
        </InfoText>
      )}
    </Flex>
  );
}
