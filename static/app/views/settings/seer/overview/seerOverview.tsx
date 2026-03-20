import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {getProviderConfigUrl} from 'sentry/components/repositories/scmIntegrationTree/providerConfigLink';
import {ScmRepoTreeModal} from 'sentry/components/repositories/scmRepoTreeModal';
import {IconAdd, IconCheckmark, IconClose, IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';

import {useAgentOptions} from 'getsentry/views/seerAutomation/components/seerAgentHooks';

function formatStatValue(value: number, outOf: number | undefined, isLoading: boolean) {
  if (isLoading) {
    return '\u2014';
  }
  return outOf === undefined ? value : `${value}\u2009/\u2009${outOf}`;
}

function Section({children}: {children?: ReactNode}) {
  return (
    <Grid
      align="center"
      border="primary"
      column="1 / -1"
      columns="subgrid"
      gap="md lg"
      padding="0 0 lg 0"
      radius="md"
    >
      {children}
    </Grid>
  );
}

function SectionHeader({children, title}: {title: string; children?: ReactNode}) {
  return (
    <Flex
      align="baseline"
      background="secondary"
      borderBottom="primary"
      column="1 / -1"
      justify="between"
      padding="md xl"
      radius="md md 0 0"
    >
      <Heading as="h2" size="sm" density="compressed">
        <Text uppercase>{title}</Text>
      </Heading>
      {children}
    </Flex>
  );
}

function StatRow({
  value,
  label,
  children,
}: {
  label: string;
  value: string | number;
  children?: ReactNode;
}) {
  return (
    <Fragment>
      <Text size="xl" bold align="right" tabular>
        {value}
      </Text>
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Flex padding="0 lg 0 3xl" align="center">
        {children}
      </Flex>
    </Fragment>
  );
}

interface Props {
  isLoading: boolean;
  stats: ReturnType<typeof useSeerOverviewData>['stats'];
}

export function SCMOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();

  return (
    <Section>
      <SectionHeader title={t('Source Code Management')}>
        {!isLoading && stats.seerIntegrationCount > 0 && stats.seerRepoCount > 0 ? (
          <Link to={`/settings/${organization.slug}/seer/scm/`}>
            <Flex align="center" gap="xs">
              {t('Configure')} <IconSettings size="xs" />
            </Flex>
          </Link>
        ) : null}
      </SectionHeader>

      <StatRow
        value={formatStatValue(stats.seerIntegrationCount, undefined, isLoading)}
        label={tn(
          'Seer-supported provider',
          'Seer-supported providers',
          stats.seerIntegrationCount
        )}
      >
        <SCMProviderWidgets stats={stats} isLoading={isLoading} />
      </StatRow>

      <StatRow
        value={formatStatValue(stats.seerRepoCount, stats.totalRepoCount, isLoading)}
        label={tn('Repository', 'Repositories', stats.seerRepoCount)}
      >
        <SCMReposWidgets stats={stats} isLoading={isLoading} />
      </StatRow>
    </Section>
  );
}

function SCMProviderWidgets({stats, isLoading}: Props) {
  if (isLoading) {
    return null;
  }
  if (stats.seerIntegrationCount === 0) {
    return (
      <Button
        priority="primary"
        size="sm"
        icon={<IconAdd />}
        onClick={() => {
          openModal(
            deps => <ScmRepoTreeModal {...deps} title={t('Install Integration')} />,
            {
              modalCss: css`
                width: 700px;
              `,
              onClose: () => {
                // TODO: invalidate queries to refresh the page
                // queryClient.invalidateQueries({queryKey: queryOptions.queryKey});
              },
            }
          );
        }}
      >
        {t('Install Integration')}
      </Button>
    );
  }
  return null;
}

function SCMReposWidgets({stats, isLoading}: Props) {
  if (isLoading || stats.seerIntegrationCount === 0) {
    return null;
  }
  if (stats.totalRepoCount === 0) {
    // no repos? link to github
    const externalLinks = stats.seerIntegrations
      .map(integration => getProviderConfigUrl(integration))
      .filter(defined);
    if (externalLinks.length === 0) {
      return (
        <Text size="sm" variant="muted">
          {t('Configure your provider to allow Sentry to see your repos.')}
        </Text>
      );
    }
    return (
      <Text size="sm" variant="muted">
        {tct('[github:Allow access] to Sentry can see your repos.', {
          github: <ExternalLink href={externalLinks[0]} />,
        })}
      </Text>
    );
  }
  if (stats.seerRepoCount !== stats.totalRepoCount) {
    return (
      <Flex align="center" gap="lg">
        <Button
          priority="primary"
          size="xs"
          icon={<IconAdd />}
          onClick={() => {
            // TODO
          }}
        >
          {t('Add all repos')}
        </Button>
        <Link
          to="#"
          onClick={e => {
            e.preventDefault();
            openModal(
              deps => <ScmRepoTreeModal {...deps} title={t('Add Repository')} />,
              {
                modalCss: css`
                  width: 700px;
                `,
                onClose: () => {
                  // TODO: invalidate queries to refresh the page
                  // queryClient.invalidateQueries({queryKey: queryOptions.queryKey});
                },
              }
            );
          }}
        >
          {t('Fine tune')}
        </Link>
      </Flex>
    );
  }
  return null;
}

export function AutofixOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();

  const {data: integrations} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
  const options = useAgentOptions({integrations: integrations ?? []});

  return (
    <Section>
      <SectionHeader title={t('Autofix')}>
        {!isLoading && (stats.projectsWithReposCount ?? 0) > 0 ? (
          <Link to={`/settings/${organization.slug}/seer/repos/`}>
            <Flex align="center" gap="xs">
              {t('Configure')} <IconSettings size="xs" />
            </Flex>
          </Link>
        ) : null}
      </SectionHeader>
      <StatRow
        value={formatStatValue(
          stats.projectsWithReposCount ?? 0,
          stats.totalProjects,
          isLoading
        )}
        label={t('Projects with repos')}
      >
        {null}
      </StatRow>

      <StatRow
        value={formatStatValue(
          stats.projectsWithAutomationCount ?? 0,
          stats.projectsWithReposCount ?? 0,
          isLoading
        )}
        label={t('Projects with Autofix Handoff enabled')}
      >
        {!isLoading &&
        stats.projectsWithReposCount &&
        stats.projectsWithReposCount !== stats.totalProjects ? (
          <Flex align="center" gap="lg">
            <Text as="label" size="sm" variant="muted">
              {t('Handoff all to:')}
            </Text>
            <CompactSelect
              size="xs"
              disabled={false}
              // options={options}
              options={options.map(option => ({
                value:
                  typeof option.value === 'string'
                    ? option.value
                    : (option.value.id ?? ''),
                label: option.label,
              }))}
              value="1"
              onChange={() => {
                // mutateSelectedAgent(option.value, {
              }}
            />
          </Flex>
        ) : null}
      </StatRow>

      <StatRow
        value={formatStatValue(
          stats.projectsWithCreatePrCount ?? 0,
          stats.projectsWithReposCount ?? 0,
          isLoading
        )}
        label={t('Projects with PR Auto Creation enabled')}
      >
        {!isLoading && stats.projectsWithReposCount ? (
          <Flex align="center" gap="sm">
            <Text as="label" size="sm" variant="muted">
              {t('Update all projects to:')}
            </Text>
            <ButtonBar>
              <Button
                size="xs"
                icon={<IconCheckmark />}
                disabled={stats.projectsWithReposCount === stats.totalProjects}
                onClick={() => {
                  // TODO
                }}
              >
                {t('Enabled')}
              </Button>
              <Button
                size="xs"
                icon={<IconClose />}
                disabled={stats.projectsWithReposCount === 0}
                onClick={() => {
                  // TODO
                }}
              >
                {t('Disabled')}
              </Button>
            </ButtonBar>
          </Flex>
        ) : null}
      </StatRow>
    </Section>
  );
}

export function CodeReviewOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();

  return (
    <Section>
      <SectionHeader title={t('Code Review')}>
        {!isLoading && stats.seerRepoCount > 0 ? (
          <Link to={`/settings/${organization.slug}/seer/code-review/`}>
            <Flex align="center" gap="xs">
              {t('Configure')} <IconSettings size="xs" />
            </Flex>
          </Link>
        ) : null}
      </SectionHeader>
      <StatRow
        value={formatStatValue(
          stats.reposWithCodeReviewCount,
          stats.seerRepoCount,
          isLoading
        )}
        label={tn('Repo enabled', 'Repos enabled', stats.reposWithCodeReviewCount)}
      >
        {!isLoading && stats.seerRepoCount ? (
          <Flex align="center" gap="sm">
            <Text as="label" size="sm" variant="muted">
              {t('Update all repos to:')}
            </Text>
            <ButtonBar>
              <Button
                size="xs"
                icon={<IconCheckmark />}
                disabled={stats.projectsWithReposCount === stats.totalProjects}
                onClick={() => {
                  // TODO
                }}
              >
                {t('Enabled')}
              </Button>
              <Button
                size="xs"
                icon={<IconClose />}
                disabled={stats.projectsWithReposCount === 0}
                onClick={() => {
                  // TODO
                }}
              >
                {t('Disabled')}
              </Button>
            </ButtonBar>
          </Flex>
        ) : null}
      </StatRow>
    </Section>
  );
}
