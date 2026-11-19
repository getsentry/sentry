import {useMemo} from 'react';
import {z} from 'zod';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

import {MockFieldError} from './mockServiceAccountApi';
import {PermissionSummary, PermissionTable, setResourceLevel} from './permissionRows';
import {
  ALL_SCOPE_IDS,
  applyGuardrails,
  BUNDLES,
  CUSTOM_BUNDLE_ID,
  DEFAULT_BUNDLE_ID,
  getActiveGuardrails,
  getBundle,
  GUARDRAILS,
  resolveBundle,
} from './serviceAccountData';
import type {ServiceAccount, ServiceAccountInput} from './types';
import {useServiceAccountAccess} from './useServiceAccountAccess';

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')),
  description: z.string(),
  projectAccess: z.enum(['all', 'specific']),
  projectIds: z.array(z.string()),
  guardrails: z.array(z.enum(['cost_impact', 'data_irreversible'])),
  bundleId: z.string(),
  customScopes: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

export function getDefaultValues(
  account: ServiceAccount | undefined,
  {hasGlobalRole}: {hasGlobalRole: boolean}
): FormValues {
  if (!account) {
    return {
      name: '',
      description: '',
      projectAccess: hasGlobalRole ? 'all' : 'specific',
      projectIds: [],
      guardrails: ['cost_impact', 'data_irreversible'],
      bundleId: DEFAULT_BUNDLE_ID,
      // Custom starts from Default Agent, so there is something to edit.
      customScopes: BUNDLES.find(bundle => bundle.id === DEFAULT_BUNDLE_ID)!.scopes,
    };
  }
  return {
    name: account.name,
    description: account.description,
    projectAccess: account.allProjects ? 'all' : 'specific',
    projectIds: account.projectIds,
    guardrails: account.guardrails,
    bundleId: account.bundleId,
    customScopes: account.customScopes,
  };
}

interface Props {
  defaultValues: FormValues;
  onCancel: () => void;
  onSubmit: (input: ServiceAccountInput) => Promise<unknown>;
  submitLabel: string;
}

export function ServiceAccountForm({
  defaultValues,
  onCancel,
  onSubmit,
  submitLabel,
}: Props) {
  const {hasGlobalRole} = useServiceAccountAccess();
  const {projects} = useProjects();
  const projectOptions = useMemo(
    () =>
      projects
        .filter(project => project.hasAccess)
        .map(project => ({
          value: project.id,
          label: project.slug,
          leadingItems: <ProjectAvatar project={project} size={16} />,
        })),
    [projects]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      if (value.projectAccess === 'all' && !hasGlobalRole) {
        setFieldErrors(formApi, {
          projectAccess: {
            message: t(
              'Only a role with access to all projects, such as Manager or Owner, can give a service account access to all projects.'
            ),
          },
        });
        return;
      }
      try {
        await onSubmit({
          name: value.name.trim(),
          description: value.description.trim(),
          allProjects: value.projectAccess === 'all',
          projectIds: value.projectAccess === 'all' ? [] : value.projectIds,
          guardrails: value.guardrails,
          bundleId: value.bundleId,
          customScopes: value.bundleId === CUSTOM_BUNDLE_ID ? value.customScopes : [],
        });
      } catch (error) {
        if (error instanceof MockFieldError) {
          setFieldErrors(
            formApi,
            Object.fromEntries(
              Object.entries(error.fields).map(([key, message]) => [key, {message}])
            )
          );
        }
      }
    },
  });

  const values = useStore(form.store, state => state.values);
  const selectedBundle = resolveBundle(values);

  // Scopes the active guardrails would remove from Custom, with the guardrail's name.
  const customBlockedScopes = new Map<string, string>();
  const unresolvedCustom = {...BUNDLES.find(b => b.id === CUSTOM_BUNDLE_ID)!};
  for (const id of getActiveGuardrails(unresolvedCustom, values.guardrails)) {
    const guardrail = GUARDRAILS.find(g => g.id === id)!;
    const allowed = applyGuardrails({...unresolvedCustom, scopes: ALL_SCOPE_IDS}, [
      id,
    ]).scopes;
    for (const scope of ALL_SCOPE_IDS) {
      if (!allowed.includes(scope)) {
        customBlockedScopes.set(scope, t('Blocked by "%s"', guardrail.name));
      }
    }
  }

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title={t('Details')}>
        <form.AppField name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('Shown in audit logs and activity wherever this account acts.')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. github-actions-deploy')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="description">
          {field => (
            <field.Layout.Row label={t('Description')} hintText={t('Optional.')}>
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                rows={2}
                autosize
                placeholder={t('e.g. Uploads source maps and creates releases')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
      </form.FieldGroup>

      <form.FieldGroup title={t('Project Access')}>
        <form.AppField name="projectAccess">
          {field => (
            <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
              {({Item}) => (
                <field.Layout.Row
                  label={t('Projects')}
                  hintText={t(
                    'All Projects needs a global role (Manager or Owner). Specific projects only lists projects you can access.'
                  )}
                >
                  <Stack gap="md">
                    <Item value="all">{t('All Projects')}</Item>
                    <Item value="specific">{t('Specific projects')}</Item>
                  </Stack>
                </field.Layout.Row>
              )}
            </field.RadioGroup>
          )}
        </form.AppField>
        {values.projectAccess === 'specific' && (
          <form.AppField
            name="projectIds"
            validators={{
              onDynamic: z.array(z.string()).min(1, t('Pick at least one project.')),
            }}
          >
            {field => (
              <field.Layout.Row label={t('Selected projects')} required>
                <field.CompactSelect
                  multiple
                  search
                  clearable
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={projectOptions}
                  menuTitle={t('Projects')}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        )}
      </form.FieldGroup>

      <form.FieldGroup title={t('Permissions')}>
        <form.AppField name="bundleId">
          {field => (
            <field.Layout.Row
              label={t('Start from')}
              hintText={
                <Stack gap="xs">
                  <Text>{getBundle(field.state.value).description}</Text>
                  <PermissionSummary bundle={selectedBundle} />
                </Stack>
              }
            >
              <field.CompactSelect
                value={field.state.value}
                onChange={value => {
                  if (value === CUSTOM_BUNDLE_ID) {
                    // Custom starts from whatever is shown now.
                    form.setFieldValue('customScopes', selectedBundle.scopes);
                  }
                  field.handleChange(value);
                }}
                options={BUNDLES.map(bundle => ({
                  value: bundle.id,
                  label: bundle.name,
                  details: bundle.description,
                }))}
                menuTitle={t('Permission presets')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="guardrails">
          {field => (
            <field.CheckboxGroup value={field.state.value} onChange={field.handleChange}>
              {({Item}) => (
                <field.Layout.Row
                  label={t('Guardrails')}
                  hintText={t('Extra restrictions on top of the permissions below.')}
                >
                  <Stack gap="md">
                    {GUARDRAILS.map(guardrail => (
                      <Item key={guardrail.id} value={guardrail.id}>
                        {guardrail.name}
                      </Item>
                    ))}
                  </Stack>
                </field.Layout.Row>
              )}
            </field.CheckboxGroup>
          )}
        </form.AppField>
        <Stack gap="md">
          <Stack gap="xs">
            <Text bold>{t('Permissions')}</Text>
            <Text size="sm" variant="muted">
              {t(
                'Read access is enough for most automation. Grant write access only for the actions this account needs to take. Changing any permission switches to Custom.'
              )}
            </Text>
          </Stack>
          <PermissionTable
            bundle={selectedBundle}
            blockedScopes={customBlockedScopes}
            onChange={(resource, level) => {
              // Changing any permission turns the preset into Custom.
              form.setFieldValue(
                'customScopes',
                setResourceLevel(selectedBundle.scopes, resource, level)
              );
              form.setFieldValue('bundleId', CUSTOM_BUNDLE_ID);
            }}
          />
        </Stack>
      </form.FieldGroup>

      <Flex justify="end" gap="md">
        <Button onClick={onCancel}>{t('Cancel')}</Button>
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}
