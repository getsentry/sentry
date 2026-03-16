import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';
import {SEER_THRESHOLD_OPTIONS} from 'sentry/views/settings/projectSeer/constants';

const seerDefaultsSchema = z.object({
  defaultSeerScannerAutomation: z.boolean(),
  defaultAutofixAutomationTuning: z.enum([
    'off',
    'super_low',
    'low',
    'medium',
    'high',
    'always',
  ]),
  enableSeerEnhancedAlerts: z.boolean(),
  enableSeerCoding: z.boolean(),
});

export function SeerAutomationDefault() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});
  const scannerEnabled = organization.defaultSeerScannerAutomation ?? false;

  const orgMutationOptions = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        data,
      }),
    onMutate: data => {
      const previousOrg = OrganizationStore.get().organization;
      if (previousOrg) {
        OrganizationStore.onUpdate(data);
        return () => {
          OrganizationStore.onUpdate(previousOrg, {replace: true});
        };
      }
      return undefined;
    },
    onSuccess: org => {
      OrganizationStore.onUpdate(org);
    },
    onError: (_error, _variables, rollback) => {
      rollback?.();
    },
  });

  return (
    <Fragment>
      {!canWrite && <OrganizationPermissionAlert />}
      <FieldGroup title={t('Default Automation for New Projects')}>
        <AutoSaveForm
          name="defaultSeerScannerAutomation"
          schema={seerDefaultsSchema}
          initialValue={organization.defaultSeerScannerAutomation ?? false}
          mutationOptions={orgMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Default for Issue Scans')}
              hintText={t(
                'Seer will scan all new and ongoing issues in your project, flagging the most actionable issues, giving more context in Slack alerts, and enabling Issue Fixes to be triggered automatically.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!canWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
        {scannerEnabled && (
          <AutoSaveForm
            name="defaultAutofixAutomationTuning"
            schema={seerDefaultsSchema}
            initialValue={organization.defaultAutofixAutomationTuning ?? 'off'}
            mutationOptions={orgMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Default for Auto-Triggered Fixes')}
                hintText={t(
                  'If Seer detects that an issue is actionable enough, it will automatically analyze it in the background. By the time you see it, the root cause and solution will already be there for you.'
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={SEER_THRESHOLD_OPTIONS}
                  disabled={!canWrite}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        )}
      </FieldGroup>
      <FieldGroup title={t('Advanced Settings')}>
        <AutoSaveForm
          name="enableSeerEnhancedAlerts"
          schema={seerDefaultsSchema}
          initialValue={organization.enableSeerEnhancedAlerts ?? true}
          mutationOptions={orgMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Enable Enhanced Alerts')}
              hintText={t(
                'Seer will provide extra context in supported alerts to make them more informative at a glance.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!canWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
        <AutoSaveForm
          name="enableSeerCoding"
          schema={seerDefaultsSchema}
          initialValue={organization.enableSeerCoding ?? true}
          mutationOptions={orgMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Enable Code Generation')}
              hintText={t('Allow members to use Seer to write code.')}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!canWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Fragment>
  );
}
