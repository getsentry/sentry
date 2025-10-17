import {Fragment, useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TriggerLabel} from 'sentry/components/core/compactSelect/control';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PreventAIOrg} from 'sentry/types/prevent';

export const ALL_REPOS_VALUE = '__$ALL_REPOS__';

function ManageReposToolbar({
  installedOrgs,
  onOrgChange,
  onRepoChange,
  selectedOrg,
  selectedRepo,
}: {
  installedOrgs: PreventAIOrg[];
  onOrgChange: (orgName: string) => void;
  onRepoChange: (repoName: string) => void;
  selectedOrg: string;
  selectedRepo: string;
}) {
  const organizationOptions = useMemo(
    () =>
      installedOrgs.map(org => ({
        value: org.name,
        label: org.name,
      })),
    [installedOrgs]
  );

  const repositoryOptions = useMemo(() => {
    const org = installedOrgs.find(o => o.name === selectedOrg);
    const repoOptions =
      org?.repos.map(repo => ({
        value: repo.name,
        label: repo.name,
      })) ?? [];

    return [
      {
        value: ALL_REPOS_VALUE,
        label: t('All Repos'),
      },
      ...repoOptions,
    ];
  }, [installedOrgs, selectedOrg]);

  return (
    <Fragment>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
          onChange={option => onOrgChange(option?.value ?? '')}
          triggerProps={{
            icon: <IconBuilding />,
            children: (
              <TriggerLabel>
                {organizationOptions.find(opt => opt.value === selectedOrg)?.label ||
                  t('Select organization')}
              </TriggerLabel>
            ),
          }}
        />

        <CompactSelect
          value={selectedRepo}
          options={repositoryOptions}
          onChange={option => onRepoChange(option?.value ?? '')}
          triggerProps={{
            icon: <IconRepository />,
            children: (
              <TriggerLabel>
                {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                  t('Select repository')}
              </TriggerLabel>
            ),
          }}
        />
      </PageFilterBar>
    </Fragment>
  );
}

export default ManageReposToolbar;
