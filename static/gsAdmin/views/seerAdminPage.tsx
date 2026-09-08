import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Region} from 'sentry/types/system';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getLocalities} from 'sentry/utils/cells';
import {fetchMutation} from 'sentry/utils/queryClient';

import {PageHeader} from 'admin/components/pageHeader';

const formSchema = z.object({
  locality: z.string().min(1, 'Select a region'),
  organizationId: z.string().trim().regex(/^\d*$/, 'Organization ID must be a number'),
  maxCandidates: z.number().min(1, 'Max candidates must be at least 1').nullable(),
  dryRun: z.boolean(),
});

type NightShiftFormData = {
  dryRun: boolean;
  locality: string;
  maxCandidates: number | null;
  organizationId: string;
};

export function SeerAdminPage() {
  const localities = getLocalities();

  const mutation = useMutation({
    mutationFn: (data: NightShiftFormData) => {
      return fetchMutation({
        url: getApiUrl('/internal/seer/night-shift/trigger/'),
        method: 'POST',
        data: {
          ...(data.organizationId
            ? {organization_id: parseInt(data.organizationId, 10)}
            : {}),
          dry_run: data.dryRun,
          ...(data.maxCandidates === null ? {} : {max_candidates: data.maxCandidates}),
        },
        options: {host: data.locality},
      });
    },
    onSuccess: (_data, variables) => {
      const mode = variables.dryRun ? ' (dry run)' : '';
      const target = variables.organizationId
        ? `organization ${variables.organizationId}`
        : 'all eligible orgs';
      addSuccessMessage(`Night shift run triggered for ${target}${mode}`);
    },
    onError: () => {
      addErrorMessage('Failed to trigger night shift run');
    },
  });

  const defaultValues: z.input<typeof formSchema> = {
    locality: localities[0]?.url ?? '',
    organizationId: '',
    maxCandidates: null,
    dryRun: false,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(formSchema.parse(value))
        .then(() => form.reset())
        .catch(() => {}),
  });

  return (
    <div>
      <PageHeader title="Seer Admin Page" />
      <Stack gap="lg">
        <Text as="p">
          Admin tools for managing Seer features. Select a region before performing
          actions.
        </Text>

        <form.AppForm form={form}>
          <Container background="secondary" border="primary" radius="md" padding="lg">
            <Stack gap="md" align="start">
              <Heading as="h3">Trigger Night Shift Run</Heading>
              <Text as="p" variant="muted">
                Dispatch a night shift run. Provide an organization ID to scope the run to
                a single org, or leave it blank to trigger the full scheduler across every
                eligible org in the selected region.
              </Text>
              <Alert.Container>
                <Alert variant="warning">
                  Be careful — this dispatches real Celery tasks that call Seer and can
                  trigger autofix runs. Leaving the organization ID blank fans out to{' '}
                  <strong>every Seer-enabled org in the region</strong>, which will incur
                  Seer cost and worker load. Prefer dry run when iterating, and don't fire
                  repeatedly.
                </Alert>
              </Alert.Container>
              <form.AppField name="locality">
                {field => (
                  <field.Layout.Stack label="Region" required>
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={localities.map((locality: Region) => ({
                        label: locality.name,
                        value: locality.url,
                      }))}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="organizationId">
                {field => (
                  <field.Layout.Stack label="Organization ID (blank = all orgs)">
                    <field.Input
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
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.Subscribe selector={state => state.values.organizationId}>
                {organizationId => (
                  <form.SubmitButton>
                    {organizationId.trim()
                      ? 'Trigger Night Shift'
                      : 'Trigger Night Shift (all orgs)'}
                  </form.SubmitButton>
                )}
              </form.Subscribe>
            </Stack>
          </Container>
        </form.AppForm>
      </Stack>
    </div>
  );
}
