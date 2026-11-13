import {useState} from 'react';
import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Disclosure} from '@sentry/scraps/disclosure';
import {EmptyState} from '@sentry/scraps/emptyState';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {getCells} from 'sentry/utils/cells';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {
  type DebuggerSearch,
  type WorkflowEngineDebuggerResponse,
  workflowEngineDebuggerApiOptions,
} from 'sentry/utils/workflowEngineDebuggerApiOptions';

import {PageHeader} from 'admin/components/pageHeader';
import {WorkflowEngineArtifacts} from 'admin/components/workflowEngine/evaluationArtifacts';
import {WorkflowEngineItemDetails} from 'admin/components/workflowEngine/itemDetails';

const positiveId = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, 'Enter a positive numeric ID')
  .refine(
    value => value.length < 19 || (value.length === 19 && value <= '9223372036854775807'),
    'ID exceeds the supported range'
  );
const itemTypeSchema = z.enum(['workflow', 'detector', 'group', 'event']);
const periodSchema = z.enum(['1h', '24h', '7d']);
const schema = z
  .object({
    cell: z.string().min(1, 'Select a cell'),
    type: itemTypeSchema,
    id: z.string().trim().min(1, 'Enter an item ID'),
    projectId: z.string(),
    statsPeriod: periodSchema,
  })
  .refine(
    value =>
      value.type === 'event'
        ? /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(
            value.id
          )
        : positiveId.safeParse(value.id).success,
    {
      path: ['id'],
      message:
        'Enter a positive numeric ID, or a 32-character event UUID for event searches',
    }
  );

const defaultValues: z.input<typeof schema> = {
  cell: '',
  type: 'workflow',
  id: '',
  projectId: '',
  statsPeriod: '24h',
};

function ConfigurationAndRelationships({
  item,
}: {
  item: WorkflowEngineDebuggerResponse['item'];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Disclosure
      expanded={expanded}
      onExpandedChange={setExpanded}
      background="primary"
      border="primary"
      radius="md"
      padding="lg"
    >
      <Disclosure.Title>Configuration and Relationships</Disclosure.Title>
      <Disclosure.Content>
        {expanded ? <WorkflowEngineItemDetails item={item} /> : null}
      </Disclosure.Content>
    </Disclosure>
  );
}

function searchErrorMessage(error: Error | null): string {
  const status = error instanceof RequestError ? error.status : undefined;
  if (status === 403 || status === 401) {
    return 'Access denied. Check your active superuser session and organization approval, then search again.';
  }
  if (status === 404) {
    return 'Lookup not found. Check the ID, selected cell, and backend environment.';
  }
  return 'Could not load evaluations. Check your connection and search again.';
}

function SearchResults({
  cell,
  cellAvailable,
  query,
  result,
  searchGeneration,
}: {
  cell: string;
  cellAvailable: boolean;
  query: UseQueryResult<WorkflowEngineDebuggerResponse>;
  result: WorkflowEngineDebuggerResponse | undefined;
  searchGeneration: number;
}) {
  if (!cellAvailable) {
    return (
      <Alert variant="warning">
        The selected cell is no longer available. Select a cell and search again.
      </Alert>
    );
  }
  if (query.isFetching) {
    return <LoadingIndicator>Searching evaluations...</LoadingIndicator>;
  }
  if (query.isError) {
    const detail =
      query.error instanceof RequestError ? query.error.responseJSON?.detail : undefined;
    return (
      <Alert variant="danger">
        {searchErrorMessage(query.error)}
        {typeof detail === 'string' ? <Text as="p">{detail}</Text> : null}
      </Alert>
    );
  }
  if (!result) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Heading as="h2" size="md" wordBreak="break-word">
        {result.item.name || `${result.item.type} ${result.item.id}`}
      </Heading>
      <Text size="md" variant="muted">
        {result.item.type} {result.item.id} · Organization {result.item.organizationId}
        {result.item.projectId ? ` · Project ${result.item.projectId}` : ''}
      </Text>
      <ConfigurationAndRelationships
        key={`${searchGeneration}:${cell}:${result.item.type}:${result.item.organizationId}:${result.item.projectId}:${result.item.id}`}
        item={result.item}
      />
      {result.truncated ? (
        <Alert variant="warning">
          Results are truncated. Use a shorter time window to narrow the search. This is
          not a complete evaluation history.
        </Alert>
      ) : null}
      <Heading as="h2" size="md">
        Evaluation Artifacts ({result.artifacts.length})
      </Heading>
      <Text size="md" variant="muted">
        Query bounds (UTC): {result.start} to {result.end}. Retention:{' '}
        {result.retentionDays} days.
      </Text>
      {result.artifacts.length === 0 ? (
        <EmptyState
          title="No Artifacts Found"
          description="The item exists, but no retained artifacts matched this time window. Emission is best effort and may be sampled; this does not prove no evaluation ran."
        />
      ) : (
        <WorkflowEngineArtifacts artifacts={result.artifacts} />
      )}
    </Stack>
  );
}

export default function WorkflowEngine() {
  const cells = getCells();
  // Batched instant refetches can skip the fetching render; force configuration to collapse.
  const [searchGeneration, setSearchGeneration] = useState(0);
  const [submitted, setSubmitted] = useState<{
    cell: string;
    search: DebuggerSearch;
  } | null>(null);
  const selectedCell = cells.find(cell => cell.name === submitted?.cell);
  const query = useQuery(
    workflowEngineDebuggerApiOptions(selectedCell, submitted?.search ?? null)
  );
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const parsed = schema.parse(value);
      if (!cells.some(cell => cell.name === parsed.cell)) {
        return;
      }
      setSearchGeneration(generation => generation + 1);
      const search: DebuggerSearch = {
        type: parsed.type,
        id: parsed.id,
        statsPeriod: parsed.statsPeriod,
        ...(parsed.type === 'event' ? {projectId: parsed.projectId.trim()} : {}),
      };
      if (
        submitted?.cell === parsed.cell &&
        submitted.search.type === search.type &&
        submitted.search.id === search.id &&
        submitted.search.statsPeriod === search.statsPeriod &&
        submitted.search.projectId === search.projectId
      ) {
        void query.refetch();
        return;
      }
      setSubmitted({cell: parsed.cell, search});
    },
  });
  let searchStatus = '';
  // Never leave previous privileged data visible while fetching or after authorization fails.
  const result = query.isSuccess && !query.isFetching ? query.data : undefined;
  if (query.isFetching) {
    searchStatus = 'Searching evaluations...';
  } else if (result) {
    searchStatus = `Evaluation artifacts found: ${result.artifacts.length}.`;
  }

  return (
    <Stack gap="xl" paddingBottom="2xl">
      <PageHeader title="Workflow Engine" />
      <Alert variant="info">
        Read-only evaluation lookup. Artifacts are emitted on a best-effort basis and may
        be sampled. Retention is seven days. Missing artifacts do not prove that an
        evaluation did not run. Active superuser access and organization approval are
        required.
      </Alert>
      {cells.length === 0 ? (
        <Alert variant="warning">
          No cells are available. Check your elevated session and reload this page.
        </Alert>
      ) : null}
      <form.AppForm form={form}>
        <Stack gap="lg" padding="xl" border="primary" radius="md">
          <Heading as="h2" size="md">
            Search Evaluations
          </Heading>
          <form.AppField name="cell">
            {field => (
              <field.Layout.Stack label="Cell" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={cells.map(cell => ({value: cell.name, label: cell.name}))}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="type">
            {field => (
              <field.Layout.Stack label="Item type" required>
                <field.Select
                  value={field.state.value}
                  onChange={value => field.handleChange(itemTypeSchema.parse(value))}
                  options={[
                    {value: 'workflow', label: 'Workflow'},
                    {value: 'detector', label: 'Detector'},
                    {value: 'group', label: 'Group'},
                    {value: 'event', label: 'Event'},
                  ]}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="id">
            {field => (
              <field.Layout.Stack
                label="Item ID"
                required
                hintText="Use a numeric workflow, detector, or group ID, or an event UUID."
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.type === 'event'}>
            {isEvent =>
              isEvent ? (
                <form.AppField name="projectId" validators={{onDynamic: positiveId}}>
                  {field => (
                    <field.Layout.Stack
                      label="Project ID"
                      required
                      hintText="Required only for event searches to identify the event's project."
                    >
                      <field.Input
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              ) : null
            }
          </form.Subscribe>
          <form.AppField name="statsPeriod">
            {field => (
              <field.Layout.Stack label="Time window" required>
                <field.Select
                  value={field.state.value}
                  onChange={value => field.handleChange(periodSchema.parse(value))}
                  options={[
                    {value: '1h', label: 'Last hour'},
                    {value: '24h', label: 'Last 24 hours'},
                    {value: '7d', label: 'Last 7 days'},
                  ]}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <Flex justify="end">
            <form.SubmitButton disabled={cells.length === 0}>Search</form.SubmitButton>
          </Flex>
        </Stack>
      </form.AppForm>
      <Text role="status" css={theme => theme.visuallyHidden}>
        {searchStatus}
      </Text>
      {submitted ? (
        <Stack gap="lg">
          <Text bold wordBreak="break-all">
            Search: {submitted.search.type} {submitted.search.id} in {submitted.cell} (
            {submitted.search.statsPeriod})
            {submitted.search.projectId ? `, project ${submitted.search.projectId}` : ''}
          </Text>
          <SearchResults
            cell={submitted.cell}
            cellAvailable={!!selectedCell}
            query={query}
            result={result}
            searchGeneration={searchGeneration}
          />
        </Stack>
      ) : (
        <EmptyState
          title="Find Evaluation Artifacts"
          description="Select a cell, enter an item ID, and search. Editing the form does not change the displayed search."
        />
      )}
    </Stack>
  );
}
