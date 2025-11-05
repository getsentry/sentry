import React, {useState} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex, Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import DropdownButton from 'sentry/components/dropdownButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconAdd, IconInfo} from 'sentry/icons';
import {IconBuilding} from 'sentry/icons/iconBuilding';
import {IconRepository} from 'sentry/icons/iconRepository';
import {t, tct} from 'sentry/locale';
import {COVERAGE_PAGE_TITLE} from 'sentry/views/prevent/settings';

const OptionLabel = styled('span')`
  white-space: normal;
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const Syncbutton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
  padding: 0 ${p => p.theme.space.xs};
  margin: -${p => p.theme.space['2xs']} -${p => p.theme.space.xs};
`;

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-wrap: wrap;
  align-items: center;

  /* Mobile responsive adjustments */
  @media (max-width: 767px) {
    gap: ${p => p.theme.space.md};
    flex-direction: column;
    align-items: stretch;
  }

  @media (max-width: 1023px) {
    gap: ${p => p.theme.space.lg};
  }
`;

const organizationOptions = [
  {
    value: 'turing-corp',
    label: <OptionLabel>Turing-Corp</OptionLabel>,
    textValue: 'Turing-Corp',
  },
  {
    value: 'Example Org-1',
    label: <OptionLabel>Example Org-1</OptionLabel>,
    textValue: 'Example Org-1',
  },
  {
    value: 'Example Org-2',
    label: <OptionLabel>Example Org-2</OptionLabel>,
    textValue: 'Example Org-2',
  },
];

const repositoryOptions = [
  {value: 'enigma', label: 'enigma'},
  {value: 'example-repo-1', label: 'example-repo-1'},
  {value: 'example-repo-2', label: 'example-repo-2'},
];

function OrgFooterMessage() {
  return (
    <Flex gap="sm" direction="column" align="start">
      <Grid columns="max-content 1fr" gap="sm">
        {props => (
          <Text variant="muted" size="sm" {...props}>
            <IconInfo size="sm" />
            <div>
              {tct(
                'Installing the [githubAppLink:GitHub Application] will require admin approval.',
                {
                  githubAppLink: (
                    <ExternalLink openInNewTab href="https://github.com/apps/sentry-io" />
                  ),
                }
              )}
            </div>
          </Text>
        )}
      </Grid>
      <LinkButton
        href="https://github.com/apps/sentry-io/installations/select_target"
        size="xs"
        icon={<IconAdd />}
        external
      >
        {t('GitHub Organization')}
      </LinkButton>
    </Flex>
  );
}

function RepoFooterMessage() {
  return (
    <Grid columns="max-content 1fr" gap="sm">
      {props => (
        <Text variant="muted" size="sm" {...props}>
          <IconInfo size="sm" />
          <div>
            {tct(
              "Sentry only displays repos you've authorized. Manage [repoAccessLink:repo access] in your GitHub settings.",
              {
                repoAccessLink: (
                  <ExternalLink
                    openInNewTab
                    href="https://github.com/settings/installations/"
                  />
                ),
              }
            )}
          </div>
        </Text>
      )}
    </Grid>
  );
}

export default function CoverageOnboardingPage() {
  const [selectedOrg, setSelectedOrg] = useState('turing-corp');
  const [selectedRepo, setSelectedRepo] = useState('enigma');

  return (
    <React.Fragment>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="between" direction="row">
            <Layout.Title>
              {COVERAGE_PAGE_TITLE}
              <FeatureBadge type="new" />
            </Layout.Title>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <LayoutGap>
          <ControlsContainer>
            <PageFilterBar condensed>
              <CompactSelect
                value={selectedOrg}
                options={organizationOptions}
                onChange={option => setSelectedOrg(String(option?.value))}
                closeOnSelect
                trigger={(triggerProps, isOpen) => (
                  <DropdownButton
                    isOpen={isOpen}
                    icon={<IconBuilding />}
                    data-test-id="page-filter-org-selector"
                    {...triggerProps}
                  >
                    <TriggerLabelWrap>
                      <TriggerLabel>
                        {organizationOptions.find(opt => opt.value === selectedOrg)
                          ?.textValue || t('Select GitHub Org')}
                      </TriggerLabel>
                    </TriggerLabelWrap>
                  </DropdownButton>
                )}
                menuWidth="280px"
                menuFooter={<OrgFooterMessage />}
              />

              <CompactSelect
                menuTitle={t('Select a Repository')}
                searchable
                disableSearchFilter
                searchPlaceholder={t('search by repository name')}
                value={selectedRepo}
                options={repositoryOptions}
                onChange={option => setSelectedRepo(String(option?.value))}
                menuWidth="16rem"
                menuHeaderTrailingItems={
                  <Syncbutton size="zero" borderless>
                    {t('Sync Repos')}
                  </Syncbutton>
                }
                menuFooter={<RepoFooterMessage />}
                trigger={(triggerProps, isOpen) => (
                  <DropdownButton
                    isOpen={isOpen}
                    icon={<IconRepository />}
                    data-test-id="page-filter-repo-selector"
                    {...triggerProps}
                  >
                    <TriggerLabel>
                      {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                        t('Select Repo')}
                    </TriggerLabel>
                  </DropdownButton>
                )}
              />
            </PageFilterBar>
          </ControlsContainer>
        </LayoutGap>
      </Layout.Body>
    </React.Fragment>
  );
}
