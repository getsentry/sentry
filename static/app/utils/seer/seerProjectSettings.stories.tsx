import {Fragment, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {infiniteQueryOptions, useInfiniteQuery} from '@tanstack/react-query';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {Checkbox} from '@sentry/scraps/checkbox';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {PreferredAgentDropdownMenu} from 'sentry/components/seer/preferredAgentDropdownMenu';
import {StoppingPointDropdownMenu} from 'sentry/components/seer/stoppingPointDropdownMenu';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import {ListItemSelectCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useProjectsById} from 'sentry/utils/project/useProjectsById';
import {
  seerAgentIntegrationsSelectQueryOptions,
  knownAgentIntegrationsQueryOptions,
  coalesePreferredAgent,
} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
  getInfiniteSeerProjectsSettingsQueryOptions,
  getMutateSeerProjectsSettingsOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {
  coaleseStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AutofixAgentSelectOption,
  InternalAutomationTuning,
  SeerAutofixStoppingPoint,
  SeerProjectSettingResponse,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

export default Storybook.story('SeerProjectSettings', story => {
  story('Autofix Project Settings', () => {
    function Example({projectSlug}: {projectSlug: string}) {
      const [showFormatted, setShowFormatted] = useState(false);

      const organization = useOrganization();

      const {data, isPending, isError, error} = useQuery({
        ...getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: projectSlug ?? ''},
        }),
        enabled: !!projectSlug,
      });

      if (isPending) {
        return (
          <Flex justify="center" padding="xl">
            <LoadingIndicator />
          </Flex>
        );
      }
      if (isError) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('Error: %s', error?.message)}</Text>
          </Flex>
        );
      }

      if (!data) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('No data found')}</Text>
          </Flex>
        );
      }

      return (
        <Stack gap="xl">
          <Flex as="label" gap="md" htmlFor="showFormatted">
            <Text>{t('Format Column Values')}</Text>
            <Checkbox
              id="showFormatted"
              checked={showFormatted}
              onChange={() => setShowFormatted(!showFormatted)}
            />
          </Flex>

          <SimpleTable style={{gridTemplateColumns: '2fr max-content repeat(2, 1fr)'}}>
            <SimpleTable.Header>
              <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Repos')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Agent')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Stopping Point')}</SimpleTable.HeaderCell>
            </SimpleTable.Header>
            <SimpleTable.Row>
              <SimpleTable.RowCell>
                <Text bold>{data.projectSlug}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text>{data.reposCount}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text>
                  {showFormatted ? <PreferredAgentLabel settings={data} /> : data.agent}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text>
                  {showFormatted ? (
                    <StoppingPointLabel
                      stoppingPoint={data.stoppingPoint}
                      automationTuning={data.automationTuning}
                    />
                  ) : (
                    data.stoppingPoint
                  )}
                </Text>
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          </SimpleTable>
        </Stack>
      );
    }

    const [projectSlug, setProjectSlug] = useQueryState('project', parseAsString);

    return (
      <Stack gap="lg">
        <Storybook.SelectProject
          projectSlug={projectSlug}
          setProjectSlug={setProjectSlug}
        />
        {projectSlug ? (
          <Example projectSlug={projectSlug} />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Stack>
    );
  });

  story('Edit Single Project Settings', () => {
    function Example({projectSlug}: {projectSlug: string}) {
      const organization = useOrganization();
      const queryClient = useQueryClient();
      const {data: knownAgents} = useQuery(
        knownAgentIntegrationsQueryOptions({organization})
      );

      const {data: agentSelectOptions = []} = useQuery(
        seerAgentIntegrationsSelectQueryOptions({organization})
      );
      const stoppingPointOptions = useStoppingPointSelectOptions();

      const {data, isPending, isError, error} = useQuery({
        ...getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: projectSlug ?? ''},
        }),
        enabled: !!projectSlug,
      });

      if (isPending) {
        return (
          <Flex justify="center" padding="xl">
            <LoadingIndicator />
          </Flex>
        );
      }

      if (isError) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('Error: %s', error.message)}</Text>
          </Flex>
        );
      }

      if (!data) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('No data found')}</Text>
          </Flex>
        );
      }

      return (
        <Stack gap="lg">
          <FieldGroup>
            <AutoSaveForm
              name="agentOption"
              schema={seerProjectSettingsSchema}
              initialValue={coalesePreferredAgent(data.agent, data.integrationId)}
              mutationOptions={getMutateSeerProjectSettingsOptions({
                organization,
                project: {slug: projectSlug},
                queryClient,
                knownAgents,
              })}
            >
              {field => (
                <field.Layout.Row
                  label={t('Agent')}
                  hintText={t(
                    'Select which agent should handle autofix for this project.'
                  )}
                >
                  <field.Select
                    multiple={false}
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={agentSelectOptions}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
          </FieldGroup>
          <FieldGroup>
            <AutoSaveForm
              name="stoppingPoint"
              schema={seerProjectSettingsSchema}
              initialValue={data.stoppingPoint}
              mutationOptions={getMutateSeerProjectSettingsOptions({
                organization,
                project: {slug: projectSlug},
                queryClient,
              })}
            >
              {field => (
                <field.Layout.Row
                  label={t('Stopping Point')}
                  hintText={t(
                    'Choose which step Seer should stop at when running automatically.'
                  )}
                >
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={stoppingPointOptions}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
          </FieldGroup>
        </Stack>
      );
    }

    const [projectSlug, setProjectSlug] = useQueryState('project', parseAsString);

    return (
      <Stack gap="lg">
        <Storybook.SelectProject
          projectSlug={projectSlug}
          setProjectSlug={setProjectSlug}
        />
        {projectSlug ? (
          <Example projectSlug={projectSlug} />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Stack>
    );
  });

  story('Autofix Projects Settings', () => {
    const [showFormatted, setShowFormatted] = useState(false);

    const organization = useOrganization();

    const queryOptions = infiniteQueryOptions({
      ...getInfiniteSeerProjectsSettingsQueryOptions({
        organization,
        query: {
          per_page: 25,
          query: MutableSearch.fromQueryObject({
            reposCount: '>0',
          }),
        },
      }),
      select: ({pages}) => pages.flatMap(page => page.json),
    });
    const result = useInfiniteQuery(queryOptions);
    useFetchAllPages({result});
    const {data, isPending, isError, error} = result;

    return (
      <ListItemCheckboxProvider
        hits={data?.length ?? 0}
        knownIds={data?.map(item => item.projectId) ?? []}
        endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
      >
        <Stack gap="xl">
          <Flex as="label" gap="md" htmlFor="showFormatted">
            <Text>{t('Format Column Values')}</Text>
            <Checkbox
              id="showFormatted"
              checked={showFormatted}
              onChange={() => setShowFormatted(!showFormatted)}
            />
          </Flex>

          <InfiniteTable.Table columns="max-content 2fr max-content repeat(2, 1fr)">
            <InfiniteTable.Header>
              <InfiniteTable.HeaderCell />
              <InfiniteTable.HeaderCell>{t('Project')}</InfiniteTable.HeaderCell>
              <InfiniteTable.HeaderCell>{t('Repos')}</InfiniteTable.HeaderCell>
              <InfiniteTable.HeaderCell>{t('Agent')}</InfiniteTable.HeaderCell>
              <InfiniteTable.HeaderCell>{t('Stopping Point')}</InfiniteTable.HeaderCell>
            </InfiniteTable.Header>
            <InfiniteTable.Scrollable style={{minHeight: '400px'}}>
              {isPending ? (
                <Flex
                  justify="center"
                  align="center"
                  padding="xl"
                  style={{minHeight: 200}}
                >
                  <LoadingIndicator />
                </Flex>
              ) : isError ? (
                <Flex
                  justify="center"
                  align="center"
                  padding="xl"
                  style={{minHeight: 200}}
                >
                  <LoadingError message={error?.message} />
                </Flex>
              ) : data.length === 0 ? (
                <InfiniteTable.Empty>{t('No projects found')}</InfiniteTable.Empty>
              ) : (
                <Fragment>
                  <InfiniteTable.Body
                    estimateSize={() => 41}
                    queryResult={result}
                    select={_ => _ ?? []}
                  >
                    {item => (
                      <InfiniteTable.Row>
                        <InfiniteTable.RowCell>
                          <ListItemSelectCheckbox
                            htmlPrefix="seer-project-settings"
                            value={item.projectId}
                          />
                        </InfiniteTable.RowCell>
                        <InfiniteTable.RowCell>
                          <Text bold>{item.projectSlug}</Text>
                        </InfiniteTable.RowCell>
                        <InfiniteTable.RowCell>
                          <Text>{item.reposCount}</Text>
                        </InfiniteTable.RowCell>
                        <InfiniteTable.RowCell>
                          <Text>
                            {showFormatted ? (
                              <PreferredAgentLabel settings={item} />
                            ) : (
                              item.agent
                            )}
                          </Text>
                        </InfiniteTable.RowCell>
                        <InfiniteTable.RowCell>
                          <Text>
                            {showFormatted ? (
                              <StoppingPointLabel
                                stoppingPoint={item.stoppingPoint}
                                automationTuning={item.automationTuning}
                              />
                            ) : (
                              item.stoppingPoint
                            )}
                          </Text>
                        </InfiniteTable.RowCell>
                      </InfiniteTable.Row>
                    )}
                  </InfiniteTable.Body>
                  <InfiniteTable.LoadingRow queryResult={result} />
                </Fragment>
              )}
            </InfiniteTable.Scrollable>
          </InfiniteTable.Table>
        </Stack>
      </ListItemCheckboxProvider>
    );
  });

  story('Autofix Bulk Dropdown Menus', () => {
    function Example({projectSlugs}: {projectSlugs: string[]}) {
      const {projects} = useProjects();
      const selectedIds = projectSlugs
        .map(slug => projects.find(p => p.slug === slug)?.id)
        .filter(defined);
      const [lastAgent, setLastAgent] = useState<AutofixAgentSelectOption | undefined>(
        undefined
      );
      const [lastStoppingPoint, setLastStoppingPoint] = useState<
        SeerAutofixStoppingPoint | undefined
      >(undefined);

      const organization = useOrganization();
      const queryClient = useQueryClient();
      const projectsById = useProjectsById();
      const {data: knownAgents} = useQuery(
        knownAgentIntegrationsQueryOptions({organization})
      );

      const {mutate} = useMutation(
        getMutateSeerProjectsSettingsOptions({
          organization,
          projectsById,
          queryClient,
          knownAgents,
        })
      );

      return (
        <Stack gap="xl">
          <Flex gap="md">
            <PreferredAgentDropdownMenu
              isDisabled={false}
              onChange={value => {
                setLastAgent(value);
                mutate({
                  query: '',
                  selectedIds,
                  agentOption: value,
                });
              }}
            />
            <StoppingPointDropdownMenu
              isDisabled={false}
              onChange={value => {
                setLastStoppingPoint(value);
                mutate({
                  query: '',
                  selectedIds,
                  stoppingPoint: value,
                });
              }}
            />
          </Flex>
          <pre>
            agent: {lastAgent} | stoppingPoint: {lastStoppingPoint}
          </pre>
        </Stack>
      );
    }

    const [projectSlugs, setProjectSlugs] = useQueryState(
      'projects',
      parseAsArrayOf(parseAsString).withDefault([])
    );

    return (
      <Stack gap="lg">
        <Storybook.SelectProjects
          projectSlugs={projectSlugs}
          setProjectSlugs={setProjectSlugs}
        />
        {projectSlugs.length ? (
          <Example projectSlugs={projectSlugs} />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Stack>
    );
  });
});

function PreferredAgentLabel({settings}: {settings: SeerProjectSettingResponse}) {
  const organization = useOrganization();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );
  return (
    <Fragment>
      {settings.agent === 'seer'
        ? t('Seer Agent')
        : (knownAgents?.find(i => i.id === settings.integrationId)?.name ??
          `${settings.agent} - ${settings.integrationId}`)}
    </Fragment>
  );
}

function StoppingPointLabel({
  stoppingPoint,
  automationTuning,
}: {
  automationTuning: InternalAutomationTuning;
  stoppingPoint: SeerAutofixStoppingPoint;
}) {
  const organization = useOrganization();
  const isLegacySeer = organization.features.includes('seer-added');
  const stoppingPointOptions = useStoppingPointSelectOptions();

  const coalesedStoppingPoint = isLegacySeer
    ? stoppingPoint
    : coaleseStoppingPoint(stoppingPoint, automationTuning);

  const label =
    stoppingPointOptions.find(option => option.value === coalesedStoppingPoint)?.label ??
    coalesedStoppingPoint;
  return <Fragment>{label}</Fragment>;
}
