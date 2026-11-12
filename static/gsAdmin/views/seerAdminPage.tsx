import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {Region} from 'sentry/types/system';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getLocalities} from 'sentry/utils/cells';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {PageHeader} from 'admin/components/pageHeader';
import {SyntheticMetricBreachForm} from 'admin/views/syntheticMetricBreachForm';

const formSchema = z.object({
  locality: z.string().min(1, 'Select a region'),
  organizationId: z
    .number()
    .int('Organization ID must be a whole number')
    .positive('Organization ID must be greater than 0')
    .nullable(),
  maxCandidates: z.number().min(1, 'Max candidates must be at least 1').nullable(),
  dryRun: z.boolean(),
  singleRun: z.boolean(),
});

const SENTRY_ORGANIZATION_ID = 1;

type NightShiftFormData = {
  dryRun: boolean;
  locality: string;
  maxCandidates: number | null;
  organizationId: number | null;
  singleRun: boolean;
};

const MAX_RETRY_RUN_IDS = 50;

function parseRunIds(value: string): number[] | null {
  const tokens = value.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > MAX_RETRY_RUN_IDS) {
    return null;
  }
  const runIds = tokens.map(Number);
  return runIds.every(id => Number.isInteger(id) && id > 0) ? runIds : null;
}

const retryFormSchema = z.object({
  locality: z.string().min(1, 'Select a region'),
  runIds: z
    .string()
    .refine(
      value => parseRunIds(value) !== null,
      `Enter 1-${MAX_RETRY_RUN_IDS} run IDs separated by commas or whitespace`
    ),
});

const SINGLE_RUN_ORGANIZATION_SLUG = 'sentry';

const singleRunFormSchema = z.object({
  locality: z.string().min(1, 'Select a region'),
  shortId: z.string().trim().min(1, 'Enter an issue short ID'),
  automated: z.boolean(),
});

type SingleRunResponse = {
  group_id: number;
  project_id: number;
  run_id: number;
  url: string;
};

type AutofixRetryResult =
  | {retried: true; run_id: number; step: string}
  | {reason: string; retried: false; run_id: number};

type AutofixRetryResponse = {
  results: AutofixRetryResult[];
};

function regionOptions(localities: Region[]) {
  return localities.map(locality => ({
    label: locality.name,
    value: locality.url,
  }));
}

function NightShiftForm() {
  const localities = getLocalities();

  const mutation = useMutation({
    mutationFn: (data: NightShiftFormData) => {
      return fetchMutation({
        url: getApiUrl('/internal/seer/night-shift/trigger/'),
        method: 'POST',
        data: {
          ...(data.organizationId === null ? {} : {organization_id: data.organizationId}),
          dry_run: data.dryRun,
          ...(data.maxCandidates === null ? {} : {max_candidates: data.maxCandidates}),
          ...(data.singleRun && data.organizationId === SENTRY_ORGANIZATION_ID
            ? {single_run: true}
            : {}),
        },
        options: {host: data.locality},
      });
    },
    onSuccess: (_data, variables) => {
      const mode = variables.dryRun ? ' (dry run)' : '';
      const target =
        variables.organizationId === null
          ? 'all eligible orgs'
          : `organization ${variables.organizationId}`;
      toast.success(`Night shift run triggered for ${target}${mode}`);
    },
    onError: () => {
      toast.error('Failed to trigger night shift run');
    },
  });

  const defaultValues: z.input<typeof formSchema> = {
    locality: localities[0]?.url ?? '',
    organizationId: null,
    maxCandidates: null,
    dryRun: false,
    singleRun: false,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(formSchema.parse(value))
        .then(() => form.setFieldValue('organizationId', null))
        .catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Container background="secondary" border="primary" radius="md" padding="lg">
        <Stack gap="lg" align="stretch">
          <Heading as="h3">Trigger Night Shift Run</Heading>
          <Text as="p" variant="muted">
            Dispatch a night shift run. Provide an organization ID to scope the run to a
            single org, or leave it blank to trigger the full scheduler across every
            eligible org in the selected region.
          </Text>
          <Alert.Container>
            <Alert variant="warning">
              Be careful — this dispatches real Celery tasks that call Seer and can
              trigger autofix runs. Leaving the organization ID blank fans out to{' '}
              <strong>every Seer-enabled org in the region</strong>, which will incur Seer
              cost and worker load. Prefer dry run when iterating, and don't fire
              repeatedly.
            </Alert>
          </Alert.Container>
          <form.AppField name="locality">
            {field => (
              <field.Layout.Stack label="Region" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={regionOptions(localities)}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="organizationId">
            {field => (
              <field.Layout.Stack label="Organization ID (blank = all orgs)">
                <field.Number
                  min={1}
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="Leave blank to trigger every eligible org"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="maxCandidates">
            {field => (
              <field.Layout.Stack label="Max candidates (optional)">
                <field.Number
                  min={1}
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="Leave blank to use default"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="dryRun">
            {field => (
              <field.Layout.Stack label="Dry run (triage only, no autofix triggered)">
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.organizationId}>
            {organizationId => (
              <form.AppField name="singleRun">
                {field => (
                  <field.Layout.Stack label="Single-run Autofix (Sentry org only)">
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={organizationId !== SENTRY_ORGANIZATION_ID}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            )}
          </form.Subscribe>
          <Flex justify="end">
            <form.SubmitButton>Trigger Night Shift</form.SubmitButton>
          </Flex>
        </Stack>
      </Container>
    </form.AppForm>
  );
}

function AutofixRetryForm() {
  const localities = getLocalities();

  const mutation = useMutation({
    mutationFn: (data: z.output<typeof retryFormSchema>) => {
      return fetchMutation<AutofixRetryResponse>({
        url: getApiUrl('/internal/seer/autofix/retry/'),
        method: 'POST',
        data: {run_ids: parseRunIds(data.runIds)},
        options: {host: data.locality},
      });
    },
    onSuccess: data => {
      const retried = data.results.filter(result => result.retried).length;
      toast.success(`Retried ${retried} of ${data.results.length} autofix runs`);
    },
    onError: () => {
      toast.error('Failed to retry autofix runs');
    },
  });

  const defaultValues: z.input<typeof retryFormSchema> = {
    locality: localities[0]?.url ?? '',
    runIds: '',
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: retryFormSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(retryFormSchema.parse(value))
        .then(() => form.setFieldValue('runIds', ''))
        .catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Container background="secondary" border="primary" radius="md" padding="lg">
        <Stack gap="lg" align="stretch">
          <Heading as="h3">Retry Autofix Runs</Heading>
          <Text as="p" variant="muted">
            Re-run the failed step of autofix runs that errored or timed out. Runs that
            aren't in an error state, have a pull request or coding agent, or failed
            during PR iteration are skipped.
          </Text>
          <form.AppField name="locality">
            {field => (
              <field.Layout.Stack label="Region" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={regionOptions(localities)}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="runIds">
            {field => (
              <field.Layout.Stack label="Run IDs" required>
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  rows={3}
                  placeholder={`Up to ${MAX_RETRY_RUN_IDS}, separated by commas or whitespace`}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <Flex justify="end">
            <form.SubmitButton>Retry Runs</form.SubmitButton>
          </Flex>
          {mutation.data && (
            <SimpleTable
              header={
                <SimpleTable.HeaderRow>
                  <SimpleTable.HeaderCell>Run ID</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>Result</SimpleTable.HeaderCell>
                </SimpleTable.HeaderRow>
              }
            >
              {mutation.data.results.map(result => (
                <SimpleTable.Row key={result.run_id}>
                  <SimpleTable.RowCell>{result.run_id}</SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    {result.retried ? (
                      <Text variant="success">Retried {result.step}</Text>
                    ) : (
                      <Text variant="muted">Skipped: {result.reason}</Text>
                    )}
                  </SimpleTable.RowCell>
                </SimpleTable.Row>
              ))}
            </SimpleTable>
          )}
        </Stack>
      </Container>
    </form.AppForm>
  );
}

function SingleRunForm() {
  const localities = getLocalities();

  const mutation = useMutation({
    mutationFn: (data: z.output<typeof singleRunFormSchema>) => {
      return fetchMutation<SingleRunResponse>({
        url: getApiUrl('/internal/seer/autofix/single-run/'),
        method: 'POST',
        data: {
          organization_slug: SINGLE_RUN_ORGANIZATION_SLUG,
          short_id: data.shortId,
          automated: data.automated,
        },
        options: {host: data.locality},
      });
    },
    onSuccess: data => {
      toast.success(`Started single run ${data.run_id}`);
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to start single run');
    },
  });

  const defaultValues: z.input<typeof singleRunFormSchema> = {
    locality: localities[0]?.url ?? '',
    shortId: '',
    automated: false,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: singleRunFormSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(singleRunFormSchema.parse(value)).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Container background="secondary" border="primary" radius="md" padding="lg">
        <Stack gap="lg" align="stretch">
          <Heading as="h3">[Temporary, for testing] Start Single-Run Autofix</Heading>
          <Text as="p" variant="muted">
            Start a single-run Autofix on one issue in the Sentry org, using the
            project&apos;s Autofix settings.
          </Text>
          <form.AppField name="locality">
            {field => (
              <field.Layout.Stack label="Region" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={regionOptions(localities)}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="shortId">
            {field => (
              <field.Layout.Stack label="Issue short ID" required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="SENTRY-5RDF"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="automated">
            {field => (
              <field.Layout.Stack label="Start as automated (no owner)">
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <Flex justify="end">
            <form.SubmitButton>Start Single Run</form.SubmitButton>
          </Flex>
          {mutation.data && (
            <ExternalLink href={mutation.data.url}>
              Open run {mutation.data.run_id}
            </ExternalLink>
          )}
        </Stack>
      </Container>
    </form.AppForm>
  );
}

export function SeerAdminPage() {
  return (
    <div>
      <PageHeader title="Seer Admin Page" />
      <Stack gap="lg">
        <Text as="p">
          Admin tools for managing Seer features. Select a region before performing
          actions.
        </Text>
        <Container width={{zero: '100%', '3xl': '50%'}}>
          <Stack gap="lg">
            <NightShiftForm />
            <AutofixRetryForm />
            <SingleRunForm />
            <SyntheticMetricBreachForm />
          </Stack>
        </Container>
      </Stack>
    </div>
  );
}
