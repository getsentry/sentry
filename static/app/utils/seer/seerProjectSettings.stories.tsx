import {Fragment, useState} from 'react';
import {
  mutationOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  SeerProjectSettingFixture,
  SeerProjectSettingsListFixture,
} from 'sentry-fixture/seerProjectSetting';

import {Checkbox} from '@sentry/scraps/checkbox';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PreferredAgentDropdownMenu} from 'sentry/components/seer/preferredAgentDropdownMenu';
import {StoppingPointDropdownMenu} from 'sentry/components/seer/stoppingPointDropdownMenu';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {ListItemSelectCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {coalesePreferredAgent, parseAgentOption} from 'sentry/utils/seer/preferredAgent';
import {seerProjectSettingsSchema} from 'sentry/utils/seer/seerProjectSettings';
import {
  coaleseStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AgentIntegration,
  AutofixAgentSelectOption,
  InternalAutomationTuning,
  SeerAutofixStoppingPoint,
  SeerProjectSettingResponse,
  SeerProjectSettingUpdatePayload,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

const STORY_COLUMNS: TableColumnConfig[] = [
  {key: 'select', width: 'max-content'},
  {key: 'project', width: '2fr'},
  {key: 'repos', width: 'max-content'},
  {key: 'agent', width: '1fr'},
  {key: 'stoppingPoint', width: '1fr'},
];

/**
 * Stands in for the coding-agent integrations the org has installed.
 */
const KNOWN_AGENTS: AgentIntegration[] = [
  {
    id: '1001',
    name: 'Claude Code Agent',
    provider: CodingAgentProvider.CLAUDE_CODE_AGENT,
  },
  {
    id: '1002',
    name: 'Cursor Cloud Agent - dev@example.com',
    provider: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
  },
];

const AGENT_SELECT_OPTIONS: Array<{label: string; value: AutofixAgentSelectOption}> = [
  {value: 'seer', label: t('Seer')},
  ...KNOWN_AGENTS.map(agent => ({
    value: `${agent.provider}::${agent.id}` as const,
    label: agent.name,
  })),
];

const PAGE_SIZE = 3;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Applies a single-field update to a settings row the way the backend would,
 * so the stories can show the new value after a fake save.
 */
function applyUpdate(
  settings: SeerProjectSettingResponse,
  data: SeerProjectSettingUpdatePayload
): SeerProjectSettingResponse {
  const {agentOption, stoppingPoint, ...rest} = data;
  const agent: Partial<Pick<SeerProjectSettingResponse, 'agent' | 'integrationId'>> =
    agentOption ? parseAgentOption(agentOption, KNOWN_AGENTS) : {};
  const tuning: Partial<Pick<SeerProjectSettingResponse, 'automationTuning'>> =
    stoppingPoint === undefined
      ? {}
      : {automationTuning: stoppingPoint === 'off' ? 'off' : 'medium'};
  return {
    ...settings,
    ...rest,
    ...agent,
    ...(agent.agent === 'seer' ? {integrationId: null} : {}),
    ...(stoppingPoint === undefined ? {} : {stoppingPoint}),
    ...tuning,
  };
}

/**
 * Mutation options that resolve locally after a short delay instead of
 * PUT-ing to the project settings endpoint.
 */
function getFakeMutateOptions(
  onSaved: (update: SeerProjectSettingUpdatePayload) => void
) {
  return mutationOptions({
    mutationFn: async (data: SeerProjectSettingUpdatePayload) => {
      await sleep(400);
      onSaved(data);
      return data;
    },
  });
}

export default Storybook.story('SeerProjectSettings', story => {
  story('Autofix Project Settings', () => {
    const [showFormatted, setShowFormatted] = useState(false);
    const data = SeerProjectSettingFixture();

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

        <SimpleTable
          style={{gridTemplateColumns: '2fr max-content repeat(2, 1fr)'}}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Repos')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Agent')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Stopping Point')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          <SimpleTable.Row>
            <SimpleTable.RowCell>
              <Text bold>{data.projectSlug}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>{data.reposCount}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                {showFormatted ? (
                  <PreferredAgentLabel settings={data} knownAgents={KNOWN_AGENTS} />
                ) : (
                  data.agent
                )}
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
  });

  story('Edit Single Project Settings', () => {
    const [data, setData] = useState(() => SeerProjectSettingFixture());
    const stoppingPointOptions = useStoppingPointSelectOptions();

    const mutateOptions = getFakeMutateOptions(update =>
      setData(current => applyUpdate(current, update))
    );

    return (
      <Stack gap="lg">
        <Text variant="muted">
          {t(
            'Saving %s: agent=%s stoppingPoint=%s',
            data.projectSlug,
            data.agent,
            data.stoppingPoint
          )}
        </Text>
        <FieldGroup>
          <AutoSaveForm
            name="agentOption"
            schema={seerProjectSettingsSchema}
            initialValue={coalesePreferredAgent(data.agent, data.integrationId)}
            mutationOptions={mutateOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Agent')}
                hintText={t('Select which agent should handle autofix for this project.')}
              >
                <field.Select
                  multiple={false}
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={AGENT_SELECT_OPTIONS}
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
            mutationOptions={mutateOptions}
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
  });

  story('Autofix Projects Settings', () => {
    const [showFormatted, setShowFormatted] = useState(false);

    const result = useInfiniteQuery({
      queryKey: ['stories', 'seer-projects-settings'],
      queryFn: async ({
        pageParam,
      }): Promise<{headers: {Link?: string}; json: SeerProjectSettingResponse[]}> => {
        await sleep(300);
        const rows = SeerProjectSettingsListFixture();
        return {
          headers: {},
          json: rows.slice(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE),
        };
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, _pages, lastPageParam) =>
        lastPage.json.length < PAGE_SIZE ? undefined : lastPageParam + 1,
      staleTime: Infinity,
    });
    const {isPending, isError, error} = result;
    const data = result.data?.pages.flatMap(page => page.json);

    return (
      <ListItemCheckboxProvider
        hits={SeerProjectSettingsListFixture().length}
        knownIds={data?.map(item => item.projectId) ?? []}
        endpointOptions={undefined}
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

          <InfiniteTable.Table columns={STORY_COLUMNS} style={{maxHeight: '400px'}}>
            <InfiniteTable.Head sticky>
              <InfiniteTable.Header>
                <InfiniteTable.HeaderCell />
                <InfiniteTable.HeaderCell>{t('Project')}</InfiniteTable.HeaderCell>
                <InfiniteTable.HeaderCell>{t('Repos')}</InfiniteTable.HeaderCell>
                <InfiniteTable.HeaderCell>{t('Agent')}</InfiniteTable.HeaderCell>
                <InfiniteTable.HeaderCell>{t('Stopping Point')}</InfiniteTable.HeaderCell>
              </InfiniteTable.Header>
            </InfiniteTable.Head>
            {isPending ? (
              <InfiniteTable.Status>
                <LoadingIndicator />
              </InfiniteTable.Status>
            ) : isError ? (
              <InfiniteTable.Status>
                <LoadingError message={error?.message} />
              </InfiniteTable.Status>
            ) : data?.length === 0 ? (
              <InfiniteTable.Empty>{t('No projects found')}</InfiniteTable.Empty>
            ) : (
              <Fragment>
                <InfiniteTable.Body
                  estimateSize={() => 41}
                  queryResult={result}
                  select={pages => pages?.pages.flatMap(page => page.json) ?? []}
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
                            <PreferredAgentLabel
                              settings={item}
                              knownAgents={KNOWN_AGENTS}
                            />
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
          </InfiniteTable.Table>
        </Stack>
      </ListItemCheckboxProvider>
    );
  });

  story('Autofix Bulk Dropdown Menus', () => {
    const [rows, setRows] = useState(() => SeerProjectSettingsListFixture().slice(0, 3));
    const [lastAgent, setLastAgent] = useState<AutofixAgentSelectOption | undefined>(
      undefined
    );
    const [lastStoppingPoint, setLastStoppingPoint] = useState<
      SeerAutofixStoppingPoint | undefined
    >(undefined);
    const queryClient = useQueryClient();

    const {mutate, isPending} = useMutation(
      {
        mutationFn: async (update: SeerProjectSettingUpdatePayload) => {
          await sleep(400);
          setRows(current => current.map(row => applyUpdate(row, update)));
          return update;
        },
      },
      queryClient
    );

    return (
      <Stack gap="xl">
        <Flex gap="md">
          <PreferredAgentDropdownMenu
            isDisabled={isPending}
            onChange={value => {
              setLastAgent(value);
              mutate({agentOption: value});
            }}
          />
          <StoppingPointDropdownMenu
            isDisabled={isPending}
            onChange={value => {
              setLastStoppingPoint(value);
              mutate({stoppingPoint: value});
            }}
          />
        </Flex>
        <pre>
          agent: {lastAgent} | stoppingPoint: {lastStoppingPoint}
        </pre>
        <SimpleTable
          style={{gridTemplateColumns: '2fr repeat(2, 1fr)'}}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Agent')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Stopping Point')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {rows.map(row => (
            <SimpleTable.Row key={row.projectId}>
              <SimpleTable.RowCell>
                <Text bold>{row.projectSlug}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text>
                  <PreferredAgentLabel settings={row} knownAgents={KNOWN_AGENTS} />
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text>
                  <StoppingPointLabel
                    stoppingPoint={row.stoppingPoint}
                    automationTuning={row.automationTuning}
                  />
                </Text>
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
        </SimpleTable>
      </Stack>
    );
  });
});

function PreferredAgentLabel({
  settings,
  knownAgents,
}: {
  knownAgents: AgentIntegration[];
  settings: SeerProjectSettingResponse;
}) {
  return (
    <Fragment>
      {settings.agent === 'seer'
        ? t('Seer Agent')
        : (knownAgents.find(i => i.id === settings.integrationId)?.name ??
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
