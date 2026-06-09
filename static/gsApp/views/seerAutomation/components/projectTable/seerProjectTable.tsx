import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {createParser, debounce, parseAsString, useQueryState} from 'nuqs';

import SeerConfigConnect2 from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {AutoSaveForm} from '@sentry/scraps/form';
import {Image} from '@sentry/scraps/image';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {ListItemSelectCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useProjectsById} from 'sentry/utils/project/useProjectsById';
import {
  useSeerAgentSelectOptions,
  knownAgentIntegrationsQueryOptions,
  coalesePreferredAgent,
} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectSettingsOptions,
  getInfiniteSeerProjectsSettingsQueryOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {
  coaleseStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
import type {AutofixAgentSelectOption} from 'sentry/utils/seer/types';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ProjectTableHeader} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const estimateSize = () => 41;

const parseAsAgentFilter = createParser<'all' | AutofixAgentSelectOption>({
  parse: value => {
    if (value === 'all' || value === 'seer') {
      return value;
    }
    if (
      [
        CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
        CodingAgentProvider.CLAUDE_CODE_AGENT,
      ].some(prefix => value.startsWith(`${prefix}::`))
    ) {
      return value as AutofixAgentSelectOption;
    }
    return null;
  },
  serialize: String,
});

export function SeerProjectTable() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  // Query Values
  const [agentFilter, setAgentFilter] = useQueryState(
    'agent',
    parseAsAgentFilter.withDefault('all')
  );
  const [searchTerm, setSearchTerm] = useQueryState(
    'name',
    parseAsString.withDefault('')
  );
  const [sortBy, setSort] = useQueryState(
    'sortBy',
    parseAsSort.withDefault({field: 'name', kind: 'asc'})
  );

  // Supporting fetch calls
  const projectsById = useProjectsById();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );
  const agentSelectOptions = useSeerAgentSelectOptions();
  const stoppingPointOptions = useStoppingPointSelectOptions();

  // Main fetch call
  const mutableSearch = MutableSearch.fromQueryObject({
    reposCount: '>0',
    agent: agentFilter === 'all' ? undefined : agentFilter,
    name: searchTerm,
  });
  const queryOptions = infiniteQueryOptions({
    ...getInfiniteSeerProjectsSettingsQueryOptions({
      organization,
      query: {
        per_page: 25,
        query: mutableSearch,
        sortBy,
      },
    }),
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  const result = useInfiniteQuery(queryOptions);
  useFetchAllPages({result});
  const {data, isPending, isError, error, hasNextPage} = result;

  if (
    !isError &&
    !isPending &&
    data?.length === 0 &&
    !hasNextPage &&
    searchTerm === '' &&
    agentFilter === 'all'
  ) {
    return (
      <Container display="flex" padding="2xl" border="primary" radius="md">
        <Flex flexGrow={1} justify="center">
          <Flex align="center" justify="center" gap="2xl">
            <Flex>
              <Image src={SeerConfigConnect2} alt="" height="132px" />
            </Flex>
            <Stack gap="xl" maxWidth="330px">
              <Heading as="h3" size="lg">
                {t('Enable Autofix on a Project')}
              </Heading>
              <Text variant="muted" size="md">
                {t(
                  'Add projects here in order to enable Autofix. Each project must be associated with a repository in order for Autofix to work.'
                )}
              </Text>
              <Flex>
                <AddProjectButton />
              </Flex>
            </Stack>
          </Flex>
        </Flex>
      </Container>
    );
  }

  return (
    <Fragment>
      <Stack>
        <Flex gap="md" wrap="wrap">
          {agentSelectOptions.length ? (
            <CompactSelect<'all' | AutofixAgentSelectOption>
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} size="md" prefix={t('Agent')}>
                  {triggerProps.children}
                </OverlayTrigger.Button>
              )}
              options={[{value: 'all', label: t('All')}, ...agentSelectOptions]}
              onChange={option => setAgentFilter(option.value)}
              value={agentFilter ?? 'all'}
            />
          ) : null}
          <InputGroup style={{flex: 1}}>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="md"
              placeholder={t('Search')}
              value={searchTerm}
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
        knownIds={data?.map(item => String(item.projectId)) ?? []}
        endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
      >
        <InfiniteTable.Table columns="max-content 2fr 74px repeat(2, 1fr)">
          <ProjectTableHeader
            settings={data ?? []}
            sort={sortBy}
            onSortClick={setSort}
            mutableSearch={mutableSearch}
          />

          <InfiniteTable.Scrollable>
            {isPending ? (
              <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
                <LoadingIndicator />
              </Flex>
            ) : isError ? (
              <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
                <LoadingError message={error?.message} />
              </Flex>
            ) : data.length === 0 ? (
              <InfiniteTable.Empty>
                {searchTerm
                  ? agentFilter === 'all'
                    ? tct('No projects found matching [searchTerm]', {
                        searchTerm: <code>{searchTerm}</code>,
                      })
                    : tct('No projects found matching [searchTerm] with [agentFilter]', {
                        searchTerm: <code>{searchTerm}</code>,
                        agentFilter: <code>{agentFilter}</code>,
                      })
                  : agentFilter === 'all'
                    ? t('No projects found')
                    : tct('No projects found with [agentFilter]', {
                        agentFilter: <code>{agentFilter}</code>,
                      })}
              </InfiniteTable.Empty>
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
                          value={String(item.projectId)}
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
                            project={
                              projectsById.get(item.projectId) ?? {slug: item.projectSlug}
                            }
                            avatarSize={16}
                          />
                        </Link>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Text tabular>{item.reposCount}</Text>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell overflow="visible">
                        <AutoSaveForm
                          name="agentOption"
                          schema={seerProjectSettingsSchema}
                          initialValue={coalesePreferredAgent(
                            item.agent,
                            item.integrationId
                          )}
                          mutationOptions={getMutateSeerProjectSettingsOptions({
                            organization,
                            project: {slug: item.projectSlug},
                            queryClient,
                            knownAgents,
                          })}
                        >
                          {field => (
                            <field.Select
                              disabled={!canWrite}
                              menuPortalTarget={document.body}
                              multiple={false}
                              onChange={field.handleChange}
                              options={agentSelectOptions}
                              // @ts-expect-error: Select component does not have a size prop defined
                              size="xs"
                              value={field.state.value}
                            />
                          )}
                        </AutoSaveForm>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Stack align="stretch" flex="1">
                          <AutoSaveForm
                            name="stoppingPoint"
                            schema={seerProjectSettingsSchema}
                            initialValue={coaleseStoppingPoint(
                              item.stoppingPoint,
                              item.automationTuning
                            )}
                            mutationOptions={getMutateSeerProjectSettingsOptions({
                              organization,
                              project: {slug: item.projectSlug},
                              queryClient,
                            })}
                          >
                            {field => (
                              <field.Select
                                disabled={!canWrite}
                                menuPortalTarget={document.body}
                                onChange={field.handleChange}
                                options={stoppingPointOptions}
                                // @ts-expect-error: Select component does not have a size prop defined
                                size="xs"
                                value={field.state.value}
                              />
                            )}
                          </AutoSaveForm>
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
}

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
