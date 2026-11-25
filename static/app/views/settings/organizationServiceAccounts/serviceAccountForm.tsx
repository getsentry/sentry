import {useMemo} from 'react';
import {z} from 'zod';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {
  ScrapsForm,
  defaultFormValidators,
  useScrapsForm,
  useSelector,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  DEFAULT_SERVICE_ACCOUNT_SCOPES,
  ServiceAccountPermissions,
} from 'sentry/views/seerWorkflows/automations/serviceAccountAccess';

import type {ServiceAccount, ServiceAccountInput} from './types';
import {useServiceAccountAccess} from './useServiceAccountAccess';

export const MAX_NAME_LENGTH = 64;

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')).max(MAX_NAME_LENGTH),
  projectAccess: z.enum(['all', 'specific']),
  projectIds: z.array(z.string()),
  scopes: z
    .array(z.string())
    .min(1, t('Give the service account at least one permission.')),
});

type FormValues = z.infer<typeof schema>;

const FORM_FIELDS = ['name', 'projectIds', 'scopes'] as const;

/** Service account errors are nested under `detail`, keyed by request field. */
export function getDetailFieldErrors(error: RequestError, fields: readonly string[]) {
  const detail = error.responseJSON?.detail;
  if (!detail || typeof detail !== 'object') {
    return {};
  }
  return Object.fromEntries(
    fields.flatMap(field => {
      const messages = (detail as Record<string, unknown>)[field];
      return Array.isArray(messages) && typeof messages[0] === 'string'
        ? [[field, {message: messages[0]}]]
        : [];
    })
  );
}

const NO_PROJECT_IDS: string[] = [];

export function useServiceAccountFormValues(account?: ServiceAccount): FormValues {
  const organization = useOrganization();
  const {hasGlobalRole} = useServiceAccountAccess();
  if (!account) {
    const grantable = new Set<string>(organization.access);
    return {
      name: '',
      projectAccess: hasGlobalRole ? 'all' : 'specific',
      projectIds: NO_PROJECT_IDS,
      scopes: DEFAULT_SERVICE_ACCOUNT_SCOPES.filter(scope => grantable.has(scope)),
    };
  }
  return {
    name: account.name,
    projectAccess: account.allProjects ? 'all' : 'specific',
    projectIds: account.projectIds,
    scopes: account.scopes,
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
        .filter(
          project => project.hasAccess || defaultValues.projectIds.includes(project.id)
        )
        .map(project => ({
          value: project.id,
          label: project.slug,
          leadingItems: <ProjectAvatar project={project} size={16} />,
        })),
    [projects, defaultValues.projectIds]
  );

  const form = useScrapsForm({
    defaultValues,
    validators: defaultFormValidators(schema),
    onSubmit: async ({value, createValidationError}) => {
      const allProjects = value.projectAccess === 'all';
      if (allProjects && !hasGlobalRole) {
        return createValidationError({
          fields: {
            projectAccess: {
              message: t(
                'Only a role with access to all projects, such as Manager or Owner, can give a service account access to all projects.'
              ),
            },
          },
        });
      }
      try {
        await onSubmit({
          name: value.name.trim(),
          allProjects,
          projectIds: allProjects ? [] : value.projectIds.map(Number),
          scopes: value.scopes,
        });
      } catch (error) {
        toast.error(
          getRequestErrorUserMessage(error, t('Unable to save service account.'))
        );
        if (error instanceof RequestError) {
          const fields = getDetailFieldErrors(error, FORM_FIELDS);
          if (Object.keys(fields).length > 0) {
            return createValidationError({fields});
          }
        }
      }
      return;
    },
  });

  const projectAccess = useSelector(form.atom, state => state.values.projectAccess);

  return (
    <ScrapsForm form={form}>
      <form.FieldGroup title={t('Details')}>
        <form.Field name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('Shown in audit logs and activity wherever this account acts.')}
              required
            >
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder={t('e.g. github-actions-deploy')}
              />
            </field.Layout.Row>
          )}
        </form.Field>
      </form.FieldGroup>

      <form.FieldGroup title={t('Project Access')}>
        <form.Field name="projectAccess">
          {field => (
            <field.RadioGroup value={field.value} onChange={field.handleChange}>
              {({Item}) => (
                <field.Layout.Row
                  label={t('Projects')}
                  hintText={t(
                    'All projects includes new ones and needs a role with access to all projects, such as Manager or Owner.'
                  )}
                >
                  <Stack gap="md">
                    <Item value="all">{t('All projects')}</Item>
                    <Item value="specific">{t('Specific projects')}</Item>
                  </Stack>
                </field.Layout.Row>
              )}
            </field.RadioGroup>
          )}
        </form.Field>
        {projectAccess === 'specific' && (
          <form.Field
            name="projectIds"
            validators={[
              {
                run: z.array(z.string()).min(1, t('Pick at least one project.')),
                triggers: ['change'],
              },
            ]}
          >
            {field => (
              <field.Layout.Row label={t('Selected projects')} required>
                <field.CompactSelect
                  multiple
                  search
                  clearable
                  value={field.value}
                  onChange={field.handleChange}
                  options={projectOptions}
                  menuTitle={t('Projects')}
                />
              </field.Layout.Row>
            )}
          </form.Field>
        )}
      </form.FieldGroup>

      <form.FieldGroup title={t('Permissions')}>
        <form.Field name="scopes">
          {field => (
            <field.Layout.Stack
              label={t('Permissions')}
              hintText={t('You can’t grant access you don’t have.')}
            >
              <field.Base>
                {() => (
                  <ServiceAccountPermissions
                    value={field.value}
                    disabled={false}
                    onChange={field.handleChange}
                  />
                )}
              </field.Base>
            </field.Layout.Stack>
          )}
        </form.Field>
      </form.FieldGroup>

      <Flex justify="end" gap="md">
        <Button onClick={onCancel}>{t('Cancel')}</Button>
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}
