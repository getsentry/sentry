import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {Sticky} from 'sentry/components/sticky';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  STATUS_GROUP_META,
  type StatusGroupKey,
  StatusGroupTooltip,
} from 'sentry/views/seerWorkflows/overview/statusGroups';

import {Overview2Card} from './issueCard';
import {
  type AutofixOverviewResponse,
  OVERVIEW2_SECTIONS,
  QUERY_STALE_TIME,
} from './types';

export default function AutofixOverview2() {
  const organization = useOrganization();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<StatusGroupKey[]>(
    'seer-autofix-overview2:collapsed-groups',
    []
  );

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<AutofixOverviewResponse>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {project: selection.projects},
        staleTime: QUERY_STALE_TIME,
      }
    ),
    enabled: pageFiltersReady,
  });

  const toggleGroup = (groupKey: StatusGroupKey, expanded: boolean) => {
    setCollapsedGroups(previous =>
      expanded
        ? previous.filter(key => key !== groupKey)
        : [...previous.filter(key => key !== groupKey), groupKey]
    );
  };

  return (
    <Feature
      organization={organization}
      features="seer-night-shift-ui"
      renderDisabled={() => <NoAccess />}
    >
      <PageFiltersContainer skipInitializeUrlParams>
        <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
          <Layout.Title>{t('Autofix Overview')}</Layout.Title>
          <Stack gap="lg" padding="lg xl">
            <PageFilterBar condensed>
              <ProjectPageFilter />
            </PageFilterBar>
            {isError ? (
              <LoadingError onRetry={refetch} />
            ) : isPending ? (
              <LoadingIndicator />
            ) : (
              <Stack gap="lg">
                {OVERVIEW2_SECTIONS.map(({key, milestone}) => {
                  const runs = data.runsByMilestone[milestone] ?? [];
                  const meta = STATUS_GROUP_META[key];
                  const expanded = !collapsedGroups.includes(key);
                  return (
                    <StatusGroup
                      key={key}
                      size="sm"
                      expanded={expanded}
                      onExpandedChange={next => toggleGroup(key, next)}
                    >
                      <GroupHeader>
                        <Disclosure.Title>
                          <Flex gap="sm" align="center">
                            <Tooltip
                              title={<StatusGroupTooltip groupKey={key} />}
                              skipWrapper
                            >
                              <meta.Icon size="sm" aria-hidden />
                            </Tooltip>
                            <Text bold>{meta.label}</Text>
                            <Badge variant="muted">{runs.length}</Badge>
                          </Flex>
                        </Disclosure.Title>
                      </GroupHeader>
                      <Disclosure.Content>
                        {runs.length === 0 ? (
                          <Container padding="md">
                            <Text as="p" variant="muted" size="sm">
                              {t('No issues')}
                            </Text>
                          </Container>
                        ) : (
                          <Stack gap="md" paddingTop="sm">
                            {runs.map(run => (
                              <Overview2Card
                                key={run.seerRunId}
                                run={run}
                                orgSlug={organization.slug}
                              />
                            ))}
                          </Stack>
                        )}
                      </Disclosure.Content>
                    </StatusGroup>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </SentryDocumentTitle>
      </PageFiltersContainer>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}

// Disclosure.Content adds its own horizontal panel padding; cards align to the
// section edge instead.
const StatusGroup = styled(Disclosure)`
  && > * + * {
    padding-left: 0;
    padding-right: 0;
  }
`;

const GroupHeader = styled(Sticky)`
  z-index: ${p => p.theme.zIndex.initial + 1};
  align-self: stretch;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};

  &[data-stuck] {
    border-radius: 0;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;
