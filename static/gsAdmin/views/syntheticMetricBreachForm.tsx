import {useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {skipToken, useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {OrganizationSummary} from 'sentry/types/organization';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getCells, getLocalities} from 'sentry/utils/cells';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

type OrganizationChoice = Pick<OrganizationSummary, 'id' | 'name' | 'slug'>;
type OrganizationSearchResult = OrganizationChoice & Pick<OrganizationSummary, 'links'>;
type MonitorChoice = Pick<MetricDetector, 'id' | 'name'>;
type BreachResponse = {eventId: string; issueId: string; issueUrl: string};
type BreachRequest = {locality: string; monitorId: number; organizationId: number};

const idSchema = z.string().refine(value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}, 'Select a valid ID');

const breachSchema = z.object({
  locality: z.string().min(1, 'Select a locality'),
  organization: z
    .object({id: idSchema, name: z.string(), slug: z.string()})
    .nullable()
    .refine(value => value !== null, 'Select an organization'),
  monitor: z
    .object({id: idSchema, name: z.string()})
    .nullable()
    .refine(value => value !== null, 'Select a metric monitor'),
});

export function SyntheticMetricBreachForm() {
  const localities = getLocalities();
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [monitorSearch, setMonitorSearch] = useState('');
  const [debouncedOrganizationSearch] = useDebouncedValue(organizationSearch, {
    wait: 250,
  });
  const [debouncedMonitorSearch] = useDebouncedValue(monitorSearch, {wait: 250});
  const mutation = useMutation({
    retry: false,
    mutationFn: ({locality, organizationId, monitorId}: BreachRequest) =>
      fetchMutation<BreachResponse>({
        url: getApiUrl('/internal/seer/metric-breaches/'),
        method: 'POST',
        data: {organizationId, monitorId},
        options: {host: locality},
      }),
  });
  const defaultValues: z.input<typeof breachSchema> = {
    locality: localities[0]?.url ?? '',
    organization: null,
    monitor: null,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: breachSchema},
    onSubmit: ({value}) => {
      const data = breachSchema.parse(value);
      if (!data.organization || !data.monitor) {
        return;
      }
      mutation.reset();
      return mutation
        .mutateAsync({
          locality: data.locality,
          organizationId: Number(data.organization.id),
          monitorId: Number(data.monitor.id),
        })
        .catch(() => {});
    },
  });
  const values = useStore(form.store, state => state.values);
  const cell = getCells().find(candidate => candidate.locality_url === values.locality);
  const organizations = useQuery({
    ...apiOptions.as<OrganizationSearchResult[]>()('/_admin/customers/search/', {
      query: {query: debouncedOrganizationSearch, per_page: 50},
      staleTime: 30_000,
    }),
    enabled: Boolean(cell && debouncedOrganizationSearch),
  });
  const monitors = useQuery(
    apiOptions.as<MonitorChoice[]>()('/organizations/$organizationIdOrSlug/detectors/', {
      path: values.organization
        ? {organizationIdOrSlug: values.organization.slug}
        : skipToken,
      query: {query: `type:metric_issue ${debouncedMonitorSearch}`.trim(), per_page: 50},
      host: values.locality,
      staleTime: 30_000,
    })
  );
  const organizationOptions = (organizations.data ?? [])
    .filter(
      organization =>
        // Local monolith responses use a simulated region URL for the same database.
        cell?.name === '--monolith--' || organization.links.regionUrl === values.locality
    )
    .map(({id, name, slug}) => ({
      value: {id, name, slug},
      label: `${name} (${slug})`,
    }));
  if (
    values.organization &&
    !organizations.data?.some(org => org.id === values.organization?.id)
  ) {
    organizationOptions.push({
      value: values.organization,
      label: `${values.organization.name} (${values.organization.slug})`,
    });
  }
  const monitorOptions = (monitors.data ?? []).map(monitor => ({
    value: monitor,
    label: monitor.name,
  }));
  if (
    values.monitor &&
    !monitors.data?.some(monitor => monitor.id === values.monitor?.id)
  ) {
    monitorOptions.push({value: values.monitor, label: values.monitor.name});
  }
  const detail =
    mutation.error instanceof RequestError
      ? mutation.error.responseJSON?.detail
      : undefined;

  return (
    <form.AppForm form={form}>
      <Container background="secondary" border="primary" radius="md" padding="lg">
        <Stack gap="lg" align="stretch">
          <Heading as="h3">Create test metric breach</Heading>
          <Text as="p" variant="muted">
            Create a new synthetic issue for a metric monitor. Every submission creates
            another issue and can trigger all matching connected actions. Investigations
            use existing telemetry; creating an issue does not confirm automation
            execution.
          </Text>
          <form.AppField name="locality">
            {field => (
              <field.Layout.Stack label="Region" required>
                <field.Select
                  value={field.state.value}
                  options={localities.map(locality => ({
                    value: locality.url,
                    label: locality.name,
                  }))}
                  onChange={value => {
                    field.handleChange(value);
                    form.setFieldValue('organization', null);
                    form.setFieldValue('monitor', null);
                    setOrganizationSearch('');
                    setMonitorSearch('');
                    mutation.reset();
                  }}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="organization">
            {field => (
              <field.Layout.Stack label="Organization" required>
                <field.Select
                  key={values.locality}
                  searchable
                  clearable
                  value={field.state.value}
                  options={organizationOptions}
                  isValueEqual={(a, b) => a.id === b.id}
                  filterOption={null}
                  placeholder="Search organizations"
                  disabled={!cell && 'Select an available locality'}
                  isLoading={
                    organizations.isFetching ||
                    organizationSearch !== debouncedOrganizationSearch
                  }
                  noOptionsMessage={() =>
                    organizationSearch
                      ? 'No organizations found'
                      : 'Type to search organizations'
                  }
                  onInputChange={(input, reason) => {
                    if (reason === 'input') {
                      setOrganizationSearch(input);
                    }
                  }}
                  onChange={organization => {
                    field.handleChange(organization);
                    form.setFieldValue('monitor', null);
                    setMonitorSearch('');
                    mutation.reset();
                  }}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="monitor">
            {field => (
              <field.Layout.Stack label="Metric monitor" required>
                <field.Select
                  key={`${values.locality}:${values.organization?.id}`}
                  searchable
                  value={field.state.value}
                  options={monitorOptions}
                  isValueEqual={(a, b) => a.id === b.id}
                  placeholder="Select a metric monitor"
                  disabled={!values.organization && 'Select an organization first'}
                  isLoading={
                    monitors.isFetching || monitorSearch !== debouncedMonitorSearch
                  }
                  filterOption={null}
                  onInputChange={(input, reason) => {
                    if (reason === 'input') {
                      setMonitorSearch(input);
                    }
                  }}
                  onChange={monitor => {
                    field.handleChange(monitor);
                    mutation.reset();
                  }}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {(organizations.isError || monitors.isError) && (
            <Alert.Container>
              <Alert variant="danger">Unable to load organizations or monitors.</Alert>
            </Alert.Container>
          )}
          <Flex justify="end">
            <form.SubmitButton
              disabled={
                !values.organization ||
                !values.monitor ||
                organizations.isFetching ||
                monitors.isFetching ||
                organizations.isError ||
                monitors.isError ||
                mutation.isPending
              }
            >
              Create test breach
            </form.SubmitButton>
          </Flex>
          {mutation.data && (
            <Alert.Container>
              <Alert variant="success">
                Test issue created.{' '}
                <ExternalLink href={mutation.data.issueUrl}>Open issue</ExternalLink>
              </Alert>
            </Alert.Container>
          )}
          {mutation.isError && (
            <Alert.Container>
              <Alert variant="danger">
                {typeof detail === 'string' ? detail : 'Unable to create test issue.'}
              </Alert>
            </Alert.Container>
          )}
        </Stack>
      </Container>
    </form.AppForm>
  );
}
