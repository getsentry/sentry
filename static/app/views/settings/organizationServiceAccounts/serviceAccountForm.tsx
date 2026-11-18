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
import {PermissionSummary, PermissionTable} from './permissionRows';
import {BUNDLES, DEFAULT_BUNDLE_ID, getBundle} from './serviceAccountData';
import type {ServiceAccount, ServiceAccountInput} from './types';
import {useServiceAccountAccess} from './useServiceAccountAccess';

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')),
  description: z.string(),
  projectAccess: z.enum(['all', 'specific']),
  projectIds: z.array(z.string()),
  bundleId: z.string(),
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
      bundleId: DEFAULT_BUNDLE_ID,
    };
  }
  return {
    name: account.name,
    description: account.description,
    projectAccess: account.allProjects ? 'all' : 'specific',
    projectIds: account.projectIds,
    bundleId: account.bundleId,
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
          bundleId: value.bundleId,
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
  const selectedBundle = getBundle(values.bundleId);

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
              label={t('Permission level')}
              hintText={
                <Stack gap="xs">
                  <Text>{getBundle(field.state.value).description}</Text>
                  <PermissionSummary bundle={selectedBundle} />
                </Stack>
              }
            >
              <field.CompactSelect
                value={field.state.value}
                onChange={field.handleChange}
                options={BUNDLES.map(bundle => ({
                  value: bundle.id,
                  label: bundle.name,
                  details: bundle.description,
                }))}
                menuTitle={t('Permission levels')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <Stack gap="md">
          <Stack gap="xs">
            <Text>{t('Permissions')}</Text>
            <Text size="sm" variant="muted">
              {t(
                'What this permission level grants. To change it, pick a different level above.'
              )}
            </Text>
          </Stack>
          <PermissionTable bundle={selectedBundle} />
        </Stack>
      </form.FieldGroup>

      <Flex justify="end" gap="md">
        <Button onClick={onCancel}>{t('Cancel')}</Button>
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}
