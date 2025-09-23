import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
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
    <Fragment>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
          onChange={option => onOrgChange(String(option?.value))}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton isOpen={isOpen} {...triggerProps}>
              <Flex justify="start" gap="sm" align="center">
                <Flex align="center" gap="sm">
                  <IconIntegratedOrg />
                  <Text size="md" bold>
                    {organizationOptions.find(opt => opt.value === selectedOrg)?.label ||
                      t('Select organization')}
                  </Text>
                </Flex>
              </Flex>
            </DropdownButton>
          )}
        />

        <CompactSelect
          value={selectedRepo}
          options={repositoryOptions}
          onChange={option => onRepoChange(String(option?.value))}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton isOpen={isOpen} {...triggerProps}>
              <Flex justify="start" gap="sm" align="center">
                <Flex align="center" gap="sm">
                  <IconRepository />
                  <Text size="md" bold>
                    {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                      t('Select repo')}
                  </Text>
                </Flex>
              </Flex>
            </DropdownButton>
          )}
        />
      </PageFilterBar>
    </Fragment>
  );
}

export default ManageReposToolbar;
