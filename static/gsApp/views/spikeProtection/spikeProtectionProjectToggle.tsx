import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {ProjectSummaryWithOptions} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {withSubscription} from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import type {SpendVisibilityBaseParams} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {
  SpendVisibilityEvents,
  trackSpendVisibilityAnaltyics,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {SPIKE_PROTECTION_OPTION_DISABLED} from 'getsentry/views/spikeProtection/constants';

const spikeProtectionSchema = z.object({
  enabled: z.boolean(),
});

interface SpikeProtectionProjectToggleProps {
  project: ProjectSummaryWithOptions;
  subscription: Subscription;
  analyticsView?: SpendVisibilityBaseParams['view'];
  disabled?: boolean;
  help?: React.ReactNode;
  label?: React.ReactNode;
  onChange?: (value: boolean) => void;
}

// If the project option is True, the feature is disabled
export const isSpikeProtectionEnabled = (p: ProjectSummaryWithOptions) =>
  !p?.options?.[SPIKE_PROTECTION_OPTION_DISABLED];

function SpikeProtectionProjectToggle({
  project,
  subscription,
  analyticsView,
  disabled = false,
  onChange,
  label,
  help,
}: SpikeProtectionProjectToggleProps) {
  const organization = useOrganization();

  const testId = `${project.slug}-spike-protection-toggle`;

  return (
    <div>
      <AutoSaveForm
        name="enabled"
        schema={spikeProtectionSchema}
        initialValue={isSpikeProtectionEnabled(project)}
        mutationOptions={{
          mutationFn: data =>
            fetchMutation({
              url: `/organizations/${organization.slug}/spike-protections/`,
              method: data.enabled ? 'POST' : 'DELETE',
              data: {projects: [project.slug]},
            }),
          onSuccess: (_data, variables) => {
            const newValue = variables.enabled;
            const updatedProject: ProjectSummaryWithOptions = {
              ...project,
              options: {
                ...project.options,
                [SPIKE_PROTECTION_OPTION_DISABLED]: !newValue,
              },
            };
            ProjectsStore.onUpdateSuccess(updatedProject);
            trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_PROJECT_TOGGLED, {
              organization,
              subscription,
              project_id: project.id,
              value: newValue,
              view: analyticsView,
            });
            onChange?.(newValue);
          },
        }}
      >
        {field =>
          label || help ? (
            <field.Layout.Row label={label} hintText={help}>
              <field.Switch
                data-test-id={testId}
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          ) : (
            <field.Switch
              data-test-id={testId}
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          )
        }
      </AutoSaveForm>
    </div>
  );
}

export default withSubscription(SpikeProtectionProjectToggle);
