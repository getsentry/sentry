import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import SeerConfigConnect2 from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Image} from '@sentry/scraps/image';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {
  bulkAutofixAutomationSettingsInfiniteOptions,
  useUpdateBulkAutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {
  PreferredAgentDropdownMenu,
  PreferredAgentLabel,
} from 'sentry/components/seer/preferredAgent';
import {StoppingPointLabel} from 'sentry/components/seer/stoppingPoint';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {DetailedProject} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {ListItemSelectCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {
  getCodingAgentSelectQueryOptions,
  useSeerAgentSelectOptions,
} from 'sentry/utils/seer/preferredAgent';
import {
  getFilteredCodingAgentName,
  type PreferredAgentProvider,
} from 'sentry/utils/seer/preferredAgentFilter';
import {
  preferredAgentFilterParser,
  filterCodingAgentQueryOptions,
} from 'sentry/utils/seer/preferredAgentFilter';
import {getInfiniteSeerProjectsSettingsQueryOptions} from 'sentry/utils/seer/seerProjectSettings';
import {
  getProjectStoppingPointMutationOptions,
  getProjectStoppingPointValueFromSettings,
  PROJECT_STOPPING_POINT_SORT_ORDER,
} from 'sentry/utils/seer/stoppingPoint';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {ProjectTableHeader} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import {SeerProjectTableRow} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableRow';

const estimateSize = () => 41;

export function SeerProjectTable() {
  const location = useLocation();
  const organization = useOrganization();

  // Query Values
  const [agentFilter, setAgentFilter] = useQueryState(
    'agent',
    preferredAgentFilterParser
  );
  const [searchTerm, setSearchTerm] = useQueryState(
    'name',
    parseAsString.withDefault('')
  );

  // Supporting fetch calls
  const agentOptions = useSeerAgentSelectOptions();

  // Main fetch call
  let mutableSearch = new MutableSearch('reposCount:>0');
  if (searchTerm) {
    mutableSearch = mutableSearch.addFilterValue('name', searchTerm);
  }
  const queryOptions = infiniteQueryOptions({
    ...getInfiniteSeerProjectsSettingsQueryOptions({
      organization,
      query: {per_page: 25, query: mutableSearch.formatString()},
    }),
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  const result = useInfiniteQuery(queryOptions);
  useFetchAllPages({result});
  const {data, isPending, isError, error} = result;

  return (
    <Fragment>
      <Stack>
        <Flex gap="md" wrap="wrap">
          {agentOptions.length ? (
            <CompactSelect<'' | PreferredAgentProvider>
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} size="md" prefix={t('Agent')}>
                  {agentFilter ? triggerProps.children : t('All')}
                </OverlayTrigger.Button>
              )}
              options={agentOptions}
              onChange={option => setAgentFilter(option.value || null)}
              value={agentFilter ?? ''}
            />
          ) : null}
          <InputGroup style={{flex: 1}}>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="md"
              placeholder={t('Search')}
              value={searchTerm ?? ''}
              onChange={e =>
                setSearchTerm(e.target.value, {limitUrlUpdates: debounce(125)})
              }
            />
          </InputGroup>
          <AddProjectButton />
        </Flex>
      </Stack>
      <ListItemCheckboxProvider
        hits={data?.length ?? 0}
        knownIds={data?.map(item => item.projectId) ?? []}
        endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
      >
        <InfiniteTable.Table columns="max-content 2fr max-content repeat(2, 1fr)">
          <InfiniteTable.Header>
            <InfiniteTable.HeaderCell />
            <InfiniteTable.HeaderCell>{t('Project')}</InfiniteTable.HeaderCell>
            <InfiniteTable.HeaderCell>{t('Repos')}</InfiniteTable.HeaderCell>
            <InfiniteTable.HeaderCell>{t('Agent')}</InfiniteTable.HeaderCell>
            <InfiniteTable.HeaderCell>{t('Stopping Point')}</InfiniteTable.HeaderCell>
          </InfiniteTable.Header>
          <InfiniteTable.Scrollable
            style={{
              minHeight: Math.min(10, data?.length ?? 0) * estimateSize(),
            }}
          >
            {isPending ? (
              <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
                <LoadingIndicator />
              </Flex>
            ) : isError ? (
              <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
                <LoadingError message={error?.message} />
              </Flex>
            ) : data.length === 0 ? (
              <InfiniteTable.Empty>{t('No projects found')}</InfiniteTable.Empty>
            ) : (
              <Fragment>
                <InfiniteTable.Body
                  estimateSize={estimateSize}
                  queryResult={result}
                  select={_ => _ ?? []}
                >
                  {item => (
                    <InfiniteTable.Row>
                      <InfiniteTable.RowCell>
                        <ListItemSelectCheckbox
                          htmlPrefix="seer-project-settings"
                          value={item.projectSlug}
                        />
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Link
                          to={{
                            pathname: `/settings/${organization.slug}/seer/projects/${item.projectSlug}/`,
                            query: location.query,
                          }}
                        >
                          <ProjectBadge
                            disableLink
                            project={{slug: item.projectSlug}}
                            avatarSize={16}
                          />
                        </Link>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Text tabular>{item.reposCount}</Text>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Text>
                          <PreferredAgentLabel settings={item} />
                        </Text>
                        <Stack align="stretch" flex="1">
                          {/* <Select
                            size="xs"
                            disabled={!canWrite}
                            name="autofixAgent"
                            options={agentOptions.data ?? []}
                            value={autofixAgent ?? 'seer'}
                            onChange={option => {
                              mutateSelectedAgent(option.value, {
                                onSuccess: () => {
                                  addSuccessMessage(
                                    tct('Selected [name] for [project]', {
                                      name: <strong>{option.label}</strong>,
                                      project: project.name,
                                    })
                                  );
                                },
                                onError: () =>
                                  addErrorMessage(
                                    tct('Failed to set [name] for [project]', {
                                      name: <strong>{option.label}</strong>,
                                      project: project.name,
                                    })
                                  ),
                              });
                            }}
                          /> */}
                        </Stack>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Text>
                          <StoppingPointLabel stoppingPoint={item.stoppingPoint} />
                        </Text>
                        <Stack align="stretch" flex="1">
                          {/* <Select
                            size="xs"
                            disabled={!canWrite}
                            name="stoppingPoint"
                            options={PROJECT_STOPPING_POINT_OPTIONS}
                            value={stoppingPointValue}
                            onChange={option => {
                              mutateStoppingPoint(
                                {stoppingPoint: option.value, project},
                                {
                                  onSuccess: () =>
                                    addSuccessMessage(
                                      tct('Updated automation steps for [project]', {
                                        project: project.name,
                                      })
                                    ),
                                  onError: () =>
                                    addErrorMessage(
                                      t('Failed to update automation steps for %s', project.name)
                                    ),
                                }
                              );
                            }}
                          /> */}
                        </Stack>
                      </InfiniteTable.RowCell>
                    </InfiniteTable.Row>
                  )}
                </InfiniteTable.Body>
                <InfiniteTable.LoadingRow queryResult={result} />
              </Fragment>
            )}
          </InfiniteTable.Scrollable>
        </InfiniteTable.Table>
      </ListItemCheckboxProvider>
    </Fragment>
  );
  // const queryClient = useQueryClient();
  // const organization = useOrganization();
  // const {
  //   projects: allProjects,
  //   fetching: fetchingProjects,
  //   fetchError: projectFetchError,
  // } = useProjects();
  // const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));
  // const codingAgentCompactSelectOptions = useQuery(
  //   filterCodingAgentQueryOptions({
  //     organization,
  //   })
  // );
  // const autofixSettingsQueryOptions = bulkAutofixAutomationSettingsInfiniteOptions({
  //   organization,
  // });
  // const result = useInfiniteQuery({
  //   ...autofixSettingsQueryOptions,
  //   select: ({pages}) =>
  //     Object.fromEntries(
  //       pages
  //         .flatMap(page => page.json)
  //         .map(setting => [String(setting.projectId), setting] as const)
  //     ),
  // });
  // useFetchAllPages({result});
  // const {
  //   data: autofixSettingsByProjectId,
  //   isPending: isPendingSettings,
  //   hasNextPage: hasNextSettingsPage,
  //   isFetchingNextPage: isFetchingNextSettingsPage,
  //   isError: isErrorSettings,
  // } = result;
  // const projects = useMemo(() => {
  //   return allProjects.filter(project => {
  //     const setting = autofixSettingsByProjectId?.[project.id];
  //     return setting?.reposCount;
  //   });
  // }, [allProjects, autofixSettingsByProjectId]);
  // const {data: integrations, isPending: isPendingIntegrations} = useQuery({
  //   ...organizationIntegrationsCodingAgents(organization),
  //   select: data => data.json.integrations ?? [],
  // });
  // const {mutate: mutateStoppingPoint} = useMutation(
  //   getProjectStoppingPointMutationOptions({organization, queryClient})
  // );
  // const {mutate: updateBulkAutofixAutomationSettings} =
  //   useUpdateBulkAutofixAutomationSettings({
  //     onSuccess: (_data, variables) => {
  //       const {projectIds, ...updates} = variables;
  //       const projectIdSet = new Set(projectIds);
  //       queryClient.setQueryData(autofixSettingsQueryOptions.queryKey, oldData => {
  //         if (!oldData) {
  //           return oldData;
  //         }
  //         return {
  //           ...oldData,
  //           pages: oldData.pages.map(page => ({
  //             ...page,
  //             json: page.json.map(setting =>
  //               projectIdSet.has(String(setting.projectId))
  //                 ? {
  //                     ...setting,
  //                     ...(updates.autofixAutomationTuning !== undefined && {
  //                       autofixAutomationTuning: updates.autofixAutomationTuning,
  //                     }),
  //                     ...(updates.automatedRunStoppingPoint !== undefined && {
  //                       automatedRunStoppingPoint: updates.automatedRunStoppingPoint,
  //                     }),
  //                   }
  //                 : setting
  //             ),
  //           })),
  //         };
  //       });
  //       for (const projectId of projectIds) {
  //         if (updates.autofixAutomationTuning !== undefined) {
  //           ProjectsStore.onUpdateSuccess({
  //             id: projectId,
  //             autofixAutomationTuning: updates.autofixAutomationTuning ?? undefined,
  //           } as Partial<DetailedProject>);
  //         }
  //       }
  //     },
  //   });
  // const [agentFilter, setAgentFilter] = useQueryState(
  //   'agent',
  //   preferredAgentFilterParser
  // );
  // const [searchTerm, setSearchTerm] = useQueryState(
  //   'query',
  //   parseAsString.withDefault('')
  // );
  // const [sort, setSort] = useQueryState(
  //   'sort',
  //   parseAsSort.withDefault({field: 'project', kind: 'asc'})
  // );
  // const sortedProjects = useMemo(() => {
  //   return projects.toSorted((a, b) => {
  //     if (sort.field === 'project') {
  //       return sort.kind === 'asc'
  //         ? a.slug.localeCompare(b.slug)
  //         : b.slug.localeCompare(a.slug);
  //     }
  //     const aSettings = autofixSettingsByProjectId?.[a.id];
  //     const bSettings = autofixSettingsByProjectId?.[b.id];
  //     if (sort.field === 'agent') {
  //       const aAgent = aSettings?.automationHandoff?.target ?? 'seer';
  //       const bAgent = bSettings?.automationHandoff?.target ?? 'seer';
  //       return sort.kind === 'asc'
  //         ? aAgent.localeCompare(bAgent)
  //         : bAgent.localeCompare(aAgent);
  //     }
  //     if (sort.field === 'steps') {
  //       const aStoppingPointOrder =
  //         PROJECT_STOPPING_POINT_SORT_ORDER[
  //           getProjectStoppingPointValueFromSettings(aSettings)
  //         ];
  //       const bStoppingPointOrder =
  //         PROJECT_STOPPING_POINT_SORT_ORDER[
  //           getProjectStoppingPointValueFromSettings(bSettings)
  //         ];
  //       return sort.kind === 'asc'
  //         ? aStoppingPointOrder - bStoppingPointOrder
  //         : bStoppingPointOrder - aStoppingPointOrder;
  //     }
  //     if (sort.field === 'repo_count') {
  //       return sort.kind === 'asc'
  //         ? (aSettings?.reposCount ?? 0) - (bSettings?.reposCount ?? 0)
  //         : (bSettings?.reposCount ?? 0) - (aSettings?.reposCount ?? 0);
  //     }
  //     return 0;
  //   });
  // }, [projects, sort, autofixSettingsByProjectId]);
  // const filteredProjects = useMemo(() => {
  //   let filtered = sortedProjects;
  //   const lowerCase = searchTerm?.toLowerCase() ?? '';
  //   if (lowerCase) {
  //     filtered = filtered.filter(project =>
  //       project.slug.toLowerCase().includes(lowerCase)
  //     );
  //   }
  //   if (agentFilter) {
  //     filtered = filtered.filter(project => {
  //       const settings = autofixSettingsByProjectId?.[project.id];
  //       const projectAgentId = settings?.automationHandoff?.target
  //         ? String(settings.automationHandoff.target)
  //         : 'seer';
  //       return projectAgentId === agentFilter;
  //     });
  //   }
  //   return filtered;
  // }, [sortedProjects, searchTerm, agentFilter, autofixSettingsByProjectId]);
  // if (
  //   !fetchingProjects &&
  //   !isPendingSettings &&
  //   !hasNextSettingsPage &&
  //   projects.length === 0
  // ) {
  //   return (
  //     <Container display="flex" padding="2xl" border="primary" radius="md">
  //       <Flex flexGrow={1} justify="center">
  //         <Flex align="center" justify="center" gap="2xl">
  //           <Flex>
  //             <Image src={SeerConfigConnect2} alt="" height="132px" />
  //           </Flex>
  //           <Stack gap="xl" maxWidth="330px">
  //             <Heading as="h3" size="lg">
  //               {t('Enable Autofix on a Project')}
  //             </Heading>
  //             <Text variant="muted" size="md">
  //               {t(
  //                 'Add projects here in order to enable Autofix. Each project must be associated with a repository in order for Autofix to work.'
  //               )}
  //             </Text>
  //             <Flex>
  //               <AddProjectButton />
  //             </Flex>
  //           </Stack>
  //         </Flex>
  //       </Flex>
  //     </Container>
  //   );
  // }
  // return (
  //   <ListItemCheckboxProvider
  //     hits={filteredProjects.length}
  //     knownIds={filteredProjects.map(project => project.id)}
  //     endpointOptions={{
  //       query: {query: searchTerm, sort, agent: agentFilter},
  //     }}
  //   >
  //     <Stack gap="lg">
  //       <Flex gap="md">
  //         {codingAgentCompactSelectOptions.data?.length ? (
  //           <CompactSelect<'' | PreferredAgentProvider>
  //             trigger={triggerProps => (
  //               <OverlayTrigger.Button {...triggerProps} size="md" prefix={t('Agent')}>
  //                 {agentFilter ? triggerProps.children : t('All')}
  //               </OverlayTrigger.Button>
  //             )}
  //             options={codingAgentCompactSelectOptions.data ?? []}
  //             onChange={option => setAgentFilter(option.value || null)}
  //             value={agentFilter ?? ''}
  //           />
  //         ) : null}
  //         <InputGroup style={{width: '100%'}}>
  //           <InputGroup.LeadingItems disablePointerEvents>
  //             <IconSearch />
  //           </InputGroup.LeadingItems>
  //           <InputGroup.Input
  //             size="md"
  //             placeholder={t('Search')}
  //             value={searchTerm ?? ''}
  //             onChange={e =>
  //               setSearchTerm(e.target.value, {limitUrlUpdates: debounce(125)})
  //             }
  //           />
  //         </InputGroup>
  //         <AddProjectButton />
  //       </Flex>
  //       <SimpleTableWithColumns>
  //         <ProjectTableHeader
  //           agentOptions={agentOptions}
  //           onSortClick={setSort}
  //           projects={filteredProjects}
  //           sort={sort}
  //           updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
  //         />
  //         {fetchingProjects ||
  //         isPendingSettings ||
  //         hasNextSettingsPage ||
  //         isFetchingNextSettingsPage ? (
  //           <SimpleTable.Empty key="loading">
  //             <LoadingIndicator />
  //           </SimpleTable.Empty>
  //         ) : projectFetchError || isErrorSettings ? (
  //           <SimpleTable.Empty>
  //             <LoadingError />
  //           </SimpleTable.Empty>
  //         ) : filteredProjects.length === 0 ? (
  //           <SimpleTable.Empty>
  //             {searchTerm
  //               ? agentFilter
  //                 ? tct('No projects found matching [searchTerm] with [agentFilter]', {
  //                     searchTerm: <code>{searchTerm}</code>,
  //                     agentFilter: <code>{getFilteredCodingAgentName(agentFilter)}</code>,
  //                   })
  //                 : tct('No projects found matching [searchTerm]', {
  //                     searchTerm: <code>{searchTerm}</code>,
  //                   })
  //               : agentFilter
  //                 ? tct('No projects found with [agentFilter]', {
  //                     agentFilter: <code>{getFilteredCodingAgentName(agentFilter)}</code>,
  //                   })
  //                 : t('No projects found')}
  //           </SimpleTable.Empty>
  //         ) : (
  //           filteredProjects.map(project => (
  //             <SeerProjectTableRow
  //               key={project.id}
  //               autofixSettings={autofixSettingsByProjectId?.[project.id]}
  //               integrations={integrations ?? []}
  //               isPendingIntegrations={isPendingIntegrations}
  //               mutateStoppingPoint={mutateStoppingPoint}
  //               project={project}
  //               agentOptions={agentOptions}
  //             />
  //           ))
  //         )}
  //       </SimpleTableWithColumns>
  //     </Stack>
  //   </ListItemCheckboxProvider>
  // );
}

// const SimpleTableWithColumns = styled(SimpleTable)`
//   grid-template-columns: max-content 3fr max-content minmax(240px, 1fr) minmax(200px, 1fr);
//   overflow: visible;
// `;

function AddProjectButton() {
  const {openModal} = useModal();

  const [isLoadingModal, setIsLoadingModal] = useState(false);

  return (
    <Button
      variant="primary"
      size="md"
      onClick={async () => {
        setIsLoadingModal(true);
        try {
          const {ProjectAddRepoModal} =
            await import('getsentry/views/seerAutomation/components/projectAddRepoModal/projectAddRepoModal');

          openModal(
            deps => <ProjectAddRepoModal {...deps} title={t('Add Project to Autofix')} />,
            {
              modalCss: css`
                width: 700px;
              `,
            }
          );
        } finally {
          setIsLoadingModal(false);
        }
      }}
      icon={<IconAdd />}
      busy={isLoadingModal}
      disabled={isLoadingModal}
    >
      {t('Add Project')}
    </Button>
  );
}
