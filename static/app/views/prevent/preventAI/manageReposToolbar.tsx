import {Fragment, useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TriggerLabel} from 'sentry/components/core/compactSelect/control';
import DropdownButton from 'sentry/components/dropdownButton';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PreventAIOrg} from 'sentry/types/prevent';

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
    return (
      org?.repos.map(repo => ({
        value: repo.name,
        label: repo.name,
      })) ?? []
    );
  }, [installedOrgs, selectedOrg]);

  return (
    <Fragment>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
          onChange={option => onOrgChange(option?.value ?? '')}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton isOpen={isOpen} icon={<IconBuilding />} {...triggerProps}>
              <TriggerLabel>
                {organizationOptions.find(opt => opt.value === selectedOrg)?.label ||
                  t('Select organization')}
              </TriggerLabel>
            </DropdownButton>
          )}
        />

        <CompactSelect
          value={selectedRepo}
          options={repositoryOptions}
          onChange={option => onRepoChange(option?.value ?? '')}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton isOpen={isOpen} icon={<IconRepository />} {...triggerProps}>
              <TriggerLabel>
                {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                  t('Select repository')}
              </TriggerLabel>
            </DropdownButton>
          )}
        />
      </PageFilterBar>
    </Fragment>
  );
}

export default ManageReposToolbar;
