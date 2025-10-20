import {Fragment, useImperativeHandle, useMemo, useRef, useState, type Ref} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TriggerLabel} from 'sentry/components/core/compactSelect/control';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PreventAIOrg} from 'sentry/types/prevent';

export const ALL_REPOS_VALUE = '__$ALL_REPOS__';

export interface ManageReposToolbarRef {
  focusRepoSelector: () => void;
}

function ManageReposToolbar({
  installedOrgs,
  onOrgChange,
  onRepoChange,
  selectedOrg,
  selectedRepo,
  ref,
}: {
  installedOrgs: PreventAIOrg[];
  onOrgChange: (orgName: string) => void;
  onRepoChange: (repoName: string) => void;
  selectedOrg: string;
  selectedRepo: string;
  ref?: Ref<ManageReposToolbarRef>;
}) {
  const repoSelectorRef = useRef<HTMLButtonElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  useImperativeHandle(ref, () => ({
    focusRepoSelector: () => {
      setIsHighlighted(true);
      setTimeout(() => setIsHighlighted(false), 2000);
    },
  }));
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
      <HighlightWrapper $isHighlighted={isHighlighted}>
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
              ref: repoSelectorRef,
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
      </HighlightWrapper>
    </Fragment>
  );
}

const HighlightWrapper = styled('div')<{$isHighlighted: boolean}>`
  border-radius: ${p => p.theme.borderRadius};
  transition:
    outline 0.2s ease,
    outline-offset 0.2s ease;
  outline: 2px solid transparent;
  outline-offset: 2px;

  ${p =>
    p.$isHighlighted &&
    css`
      outline-color: ${p.theme.purple300};
      outline-width: 2px;
    `}
`;

export default ManageReposToolbar;
