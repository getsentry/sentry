import {useTheme} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import type {IntegrationOrg} from 'sentry/views/prevent/preventAI/usePreventAIOrgRepos';

function ManageReposToolbar({
  installedOrgs,
}: {
  installedOrgs: IntegrationOrg[];
  setIsPanelOpen: (isPanelOpen: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Flex gap="md" align="center" style={{marginBottom: 16}}>
      {/* Organization Dropdown */}
      <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <Text size="sm" style={{marginRight: 8}}>
          {t('Organization')}:
        </Text>
        <select
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            border: `1px solid ${theme.border}`,
          }}
          // For demo, just select first org, you may want to manage selectedOrg in state
          defaultValue={installedOrgs[0]?.id ?? ''}
          // onChange={e => setSelectedOrg(e.target.value)}
          disabled={installedOrgs.length === 0}
        >
          {installedOrgs.map(org => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </label>
      {/* Repo Dropdown */}
      <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <Text size="sm" style={{marginRight: 8}}>
          {t('Repository')}:
        </Text>
        <select
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            border: `1px solid ${theme.border}`,
          }}
          // For demo, just select first repo of first org, you may want to manage selectedRepo in state
          defaultValue={installedOrgs[0]?.repos?.[0]?.id ?? ''}
          // onChange={e => setSelectedRepo(e.target.value)}
          disabled={installedOrgs[0]?.repos?.length === 0}
        >
          {(installedOrgs[0]?.repos ?? []).map(repo => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
      </label>
    </Flex>
  );
}

export default ManageReposToolbar;
