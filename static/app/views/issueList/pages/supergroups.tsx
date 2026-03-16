import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {FeatureBadge} from '@sentry/scraps/badge';
import {inlineCodeStyles} from '@sentry/scraps/code';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {useDrawer} from 'sentry/components/globalDrawer';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {IconFocus} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface ListSupergroupsResponse {
  data: SupergroupDetail[];
}

function SupergroupCard({
  supergroup,
  projects,
  onClick,
}: {
  onClick: () => void;
  projects: Project[];
  supergroup: SupergroupDetail;
}) {
  return (
    <CardContainer background="primary" border="primary" radius="md" onClick={onClick}>
      <Stack padding="lg" gap="md">
        <Text size="lg" bold wordBreak="break-word">
          {supergroup.title}
        </Text>

        <Stack gap="xs">
          <Flex align="center" gap="sm">
            <Text size="xs" variant="muted">
              {tn('%s issue', '%s issues', supergroup.group_ids.length)}
            </Text>
            {projects.length > 0 && (
              <Flex align="center" gap="xs">
                {projects.map(project => (
                  <Flex key={project.id} align="center" gap="xs">
                    <ProjectAvatar project={project} size={14} />
                    <Text size="xs" variant="muted">
                      {project.slug}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </Flex>
          {supergroup.error_type && (
            <Flex align="baseline" gap="xs">
              <Text size="xs" variant="muted" bold>
                {t('Error:')}
              </Text>
              <Text size="xs" variant="muted">
                {supergroup.error_type}
              </Text>
            </Flex>
          )}
          {supergroup.code_area && (
            <Flex align="baseline" gap="xs">
              <Text size="xs" variant="muted" bold>
                {t('Location:')}
              </Text>
              <Text size="xs" variant="muted">
                {supergroup.code_area}
              </Text>
            </Flex>
          )}
        </Stack>

        {supergroup.summary && (
          <Container background="secondary" border="primary" radius="md">
            <Flex direction="column" padding="md lg" gap="sm">
              <Flex align="center" gap="xs">
                <IconFocus size="xs" variant="promotion" />
                <Text size="sm" bold>
                  {t('Root Cause')}
                </Text>
              </Flex>
              <Text size="sm">
                <StyledMarkedText text={supergroup.summary} inline as="span" />
              </Text>
            </Flex>
          </Container>
        )}
      </Stack>
    </CardContainer>
  );
}

function Supergroups() {
  const organization = useOrganization();
  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  const {openDrawer} = useDrawer();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const {
    data: response,
    isPending: isSupergroupsPending,
    isError: isSupergroupsError,
    refetch,
  } = useApiQuery<ListSupergroupsResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/seer/supergroups/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 60000,
      enabled: hasTopIssuesUI,
    }
  );

  const supergroups = (response?.data ?? []).filter(sg => sg.group_ids.length > 1);

  // Collect all group IDs from visible supergroups to fetch their issue details
  const allGroupIds = useMemo(
    () => [...new Set(supergroups.flatMap(sg => sg.group_ids))],
    [supergroups]
  );

  const {data: groups, isPending: isGroupsPending} = useApiQuery<Group[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          query: `issue.id:[${allGroupIds.join(',')}]`,
          limit: allGroupIds.length.toString(),
          project: '-1',
        },
      },
    ],
    {
      staleTime: 60000,
      enabled: allGroupIds.length > 0,
    }
  );

  // Build a map of groupId -> project
  const groupProjectMap = useMemo(() => {
    const map = new Map<number, Project>();
    if (groups) {
      for (const group of groups) {
        map.set(Number(group.id), group.project);
      }
    }
    return map;
  }, [groups]);

  // Get unique projects for each supergroup
  const supergroupProjectsMap = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const sg of supergroups) {
      const seen = new Set<string>();
      const projects: Project[] = [];
      for (const gid of sg.group_ids) {
        const project = groupProjectMap.get(gid);
        if (project && !seen.has(project.id)) {
          seen.add(project.id);
          projects.push(project);
        }
      }
      map.set(sg.id, projects);
    }
    return map;
  }, [supergroups, groupProjectMap]);

  // Get all unique projects across all supergroups for the filter dropdown
  const allProjects = useMemo(() => {
    const seen = new Map<string, Project>();
    for (const projects of supergroupProjectsMap.values()) {
      for (const project of projects) {
        if (!seen.has(project.id)) {
          seen.set(project.id, project);
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }, [supergroupProjectsMap]);

  const projectFilterOptions: Array<SelectOption<string>> = useMemo(
    () => [
      {value: '', label: t('All Projects')},
      ...allProjects.map(project => ({
        value: project.id,
        label: project.slug,
        leadingItems: <ProjectAvatar project={project} size={16} />,
      })),
    ],
    [allProjects]
  );

  // Filter supergroups by selected project
  const filteredSupergroups = useMemo(() => {
    if (!selectedProjectId) {
      return supergroups;
    }
    return supergroups.filter(sg => {
      const projects = supergroupProjectsMap.get(sg.id) ?? [];
      return projects.some(p => p.id === selectedProjectId);
    });
  }, [supergroups, selectedProjectId, supergroupProjectsMap]);

  const isPending = isSupergroupsPending || (allGroupIds.length > 0 && isGroupsPending);

  const handleSupergroupClick = (supergroup: SupergroupDetail) => {
    openDrawer(() => <SupergroupDetailDrawer supergroup={supergroup} />, {
      ariaLabel: t('Supergroup details'),
      drawerKey: 'supergroup-drawer',
    });
  };

  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <Layout.Page>
      <Layout.Header noActionWrap unified>
        <Layout.HeaderContent>
          <Flex align="center" gap="md">
            <Heading as="h1">{t('Supergroups')}</Heading>
            <FeatureBadge type="experimental" />
          </Flex>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <FeedbackButton
            size="sm"
            feedbackOptions={{
              messagePlaceholder: t('What do you think about Supergroups?'),
              tags: {
                ['feedback.source']: 'supergroups',
                ['feedback.owner']: 'issues',
              },
            }}
          />
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main width="full">
          {isPending ? (
            <LoadingIndicator />
          ) : isSupergroupsError ? (
            <LoadingError onRetry={refetch} />
          ) : supergroups.length === 0 ? (
            <Container padding="lg" border="primary" radius="md" background="primary">
              <Text variant="muted" align="center" as="div">
                {t('No supergroups found')}
              </Text>
            </Container>
          ) : (
            <Stack gap="lg">
              <Flex align="center" gap="lg">
                {allProjects.length > 1 && (
                  <CompactSelect
                    triggerLabel={
                      selectedProjectId
                        ? (allProjects.find(p => p.id === selectedProjectId)?.slug ??
                          t('All Projects'))
                        : t('All Projects')
                    }
                    triggerProps={{size: 'xs'}}
                    options={projectFilterOptions}
                    value={selectedProjectId}
                    onChange={opt => setSelectedProjectId(opt.value)}
                  />
                )}
                <Text size="sm" variant="muted">
                  {tn('%s supergroup', '%s supergroups', filteredSupergroups.length)}
                </Text>
              </Flex>
              {filteredSupergroups.length === 0 ? (
                <Container padding="lg" border="primary" radius="md" background="primary">
                  <Text variant="muted" align="center" as="div">
                    {t('No supergroups match the selected project')}
                  </Text>
                </Container>
              ) : (
                <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="lg">
                  {filteredSupergroups.map(sg => (
                    <SupergroupCard
                      key={sg.id}
                      supergroup={sg}
                      projects={supergroupProjectsMap.get(sg.id) ?? []}
                      onClick={() => handleSupergroupClick(sg)}
                    />
                  ))}
                </Grid>
              )}
            </Stack>
          )}
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

const CardContainer = styled(Container)`
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.accent.moderate};
    box-shadow: ${p => p.theme.dropShadowMedium};
  }
`;

export const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;

export default Supergroups;
