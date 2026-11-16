import {useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {skipToken, useInfiniteQuery, useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
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
type MonitorChoice = Pick<MetricDetector, 'id' | 'name' | 'projectId'>;
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
    .object({id: idSchema, name: z.string(), projectId: idSchema})
    .nullable()
    .refine(value => value !== null, 'Select a metric monitor'),
});

function monitorLabel(monitor: MonitorChoice) {
  return `${monitor.name} (Project ID: ${monitor.projectId}, Monitor ID: ${monitor.id})`;
}

export function SyntheticMetricBreachForm() {
  const localities = getLocalities();
  const defaultLocality = localities[0]?.url ?? '';
  const defaultCell = getCells().find(cell => cell.locality_url === defaultLocality);
  const defaultOrganizations = useQuery(
    apiOptions.as<OrganizationChoice[]>()('/_admin/cells/$region/customers/', {
      path: defaultCell ? {region: defaultCell.name} : skipToken,
      query: {query: 'slug:sentry', per_page: 1},
      host: defaultLocality,
      staleTime: 30_000,
    })
  );
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
    locality: defaultLocality,
    organization: defaultOrganizations.data?.find(org => org.slug === 'sentry') ?? null,
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
  const organizations = useInfiniteQuery({
    ...apiOptions.asInfinite<OrganizationChoice[]>()('/_admin/cells/$region/customers/', {
      path: cell ? {region: cell.name} : skipToken,
      query: {query: debouncedOrganizationSearch, per_page: 50, sortBy: 'members'},
      host: values.locality,
      staleTime: 30_000,
    }),
    enabled: Boolean(cell && debouncedOrganizationSearch),
    select: data => data.pages.flatMap(page => page.json),
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
  const normalizedOrganizationSearch = debouncedOrganizationSearch.trim().toLowerCase();
  const organizationOptions = (organizations.data ?? [])
    .toSorted(
      (a, b) =>
        Number(b.slug.toLowerCase() === normalizedOrganizationSearch) -
        Number(a.slug.toLowerCase() === normalizedOrganizationSearch)
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
    label: monitorLabel(monitor),
  }));
  if (
    values.monitor &&
    !monitors.data?.some(monitor => monitor.id === values.monitor?.id)
  ) {
    monitorOptions.push({value: values.monitor, label: monitorLabel(values.monitor)});
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
                  menuFooter={
                    organizations.hasNextPage && (
                      <Container padding="sm">
                        <Button
                          size="sm"
                          disabled={
                            organizations.isFetching ||
                            organizationSearch !== debouncedOrganizationSearch
                          }
                          onClick={() => organizations.fetchNextPage()}
                        >
                          Load more organizations
                        </Button>
                      </Container>
                    )
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
