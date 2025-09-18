import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconIntegratedOrg} from 'sentry/icons/iconIntegratedOrg';
import {IconRepository} from 'sentry/icons/iconRepository';
import {t} from 'sentry/locale';
import type {PreventAIOrg} from 'sentry/views/prevent/preventAI/types';

function ManageReposToolbar({
  installedOrgs,
  onOrgChange,
  onRepoChange,
  selectedOrg,
  selectedRepo,
}: {
  installedOrgs: PreventAIOrg[];
  onOrgChange: (orgId: string) => void;
  onRepoChange: (repoId: string) => void;
  selectedOrg: string;
  selectedRepo: string;
}) {
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

  return (
    <ControlsContainer>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
          onChange={option => onOrgChange(String(option?.value))}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton isOpen={isOpen} {...triggerProps}>
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
          onChange={option => onRepoChange(String(option?.value))}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton isOpen={isOpen} {...triggerProps}>
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
  font-weight: 600;
`;

export default ManageReposToolbar;
