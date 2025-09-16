import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconIntegratedOrg} from 'sentry/components/prevent/integratedOrgSelector/iconIntegratedOrg';
import {IconRepository} from 'sentry/components/prevent/repoSelector/iconRepository';
import {t} from 'sentry/locale';
import type {IntegrationOrg} from 'sentry/views/prevent/preventAI/types';

function ManageReposToolbar({installedOrgs}: {installedOrgs: IntegrationOrg[]}) {
  // Default to first org/repo if available
  const [selectedOrg, setSelectedOrg] = useState(installedOrgs[0]?.id ?? '');
  const [selectedRepo, setSelectedRepo] = useState(
    installedOrgs[0]?.repos?.[0]?.id ?? ''
  );

  // Memoize options for performance
  const organizationOptions = useMemo(
    () =>
      installedOrgs.map(org => ({
        value: org.id,
        label: org.name,
      })),
    [installedOrgs]
  );

  const repositoryOptions = useMemo(() => {
    const org = installedOrgs.find(o => o.id === selectedOrg);
    return (
      org?.repos.map(repo => ({
        value: repo.id,
        label: repo.name,
      })) ?? []
    );
  }, [installedOrgs, selectedOrg]);

  // Keep selectedRepo in sync if org changes
  // (If selectedRepo is not in new org, pick first repo)

  useMemo(() => {
    const repoIds = repositoryOptions.map(r => r.value);
    if (!repoIds.includes(selectedRepo)) {
      setSelectedRepo(repoIds[0] ?? '');
    }
  }, [repositoryOptions, selectedRepo]);

  return (
    <ControlsContainer>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
          onChange={option => setSelectedOrg(String(option?.value))}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton
              isOpen={isOpen}
              data-test-id="page-filter-org-selector"
              {...triggerProps}
            >
              <TriggerLabelWrap>
                <Flex align="center" gap="sm">
                  <IconContainer>
                    <IconIntegratedOrg />
                  </IconContainer>
                  <TriggerLabel>
                    {organizationOptions.find(opt => opt.value === selectedOrg)?.label ||
                      t('Select organization')}
                  </TriggerLabel>
                </Flex>
              </TriggerLabelWrap>
            </DropdownButton>
          )}
        />

        <CompactSelect
          value={selectedRepo}
          options={repositoryOptions}
          onChange={option => setSelectedRepo(String(option?.value))}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton
              isOpen={isOpen}
              data-test-id="page-filter-repo-selector"
              {...triggerProps}
            >
              <TriggerLabelWrap>
                <Flex align="center" gap="sm">
                  <IconContainer>
                    <IconRepository />
                  </IconContainer>
                  <TriggerLabel>
                    {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                      t('Select repo')}
                  </TriggerLabel>
                </Flex>
              </TriggerLabelWrap>
            </DropdownButton>
          )}
        />
      </PageFilterBar>
    </ControlsContainer>
  );
}

const ControlsContainer = styled('div')`
  margin-bottom: 16px;
`;

const TriggerLabelWrap = styled('span')`
  display: flex;
  align-items: center;
`;

const IconContainer = styled('span')`
  display: flex;
  align-items: center;
  margin-right: 6px;
`;

const TriggerLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 500;
`;

export default ManageReposToolbar;
