import {useEffect, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import BooleanField, {
  type BooleanFieldProps,
} from 'sentry/components/forms/fields/booleanField';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import type {SpendVisibilityBaseParams} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import trackSpendVisibilityAnaltyics, {
  SpendVisibilityEvents,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {
  SPIKE_PROTECTION_ERROR_MESSAGE,
  SPIKE_PROTECTION_OPTION_DISABLED,
} from 'getsentry/views/spikeProtection/constants';

interface SpikeProtectionProjectToggleProps extends Omit<BooleanFieldProps, 'name'> {
  project: Project;
  subscription: Subscription;
  analyticsView?: SpendVisibilityBaseParams['view'];
  disabled?: boolean;
}

// If the project option is True, the feature is disabled
export const isSpikeProtectionEnabled = (p: Project) =>
  !p?.options?.[SPIKE_PROTECTION_OPTION_DISABLED];

function SpikeProtectionProjectToggle({
  project,
  subscription,
  analyticsView,
  disabled = false,
  onChange,
  ...fieldProps
}: SpikeProtectionProjectToggleProps) {
  const api = useApi();
  const organization = useOrganization();
  const [isToggleEnabled, setIsToggleEnabled] = useState(
    isSpikeProtectionEnabled(project)
  );

  // Reload from props if new project state is received
  useEffect(() => {
    setIsToggleEnabled(isSpikeProtectionEnabled(project));
  }, [project]);

  async function toggleFeature(newValue: boolean, event: React.FormEvent) {
    const endpoint = `/organizations/${organization.slug}/spike-protections/`;
    setIsToggleEnabled(newValue);
    try {
      await api.requestPromise(endpoint, {
        method: newValue ? 'POST' : 'DELETE',
        data: {projects: [project.slug]},
      });
      addSuccessMessage(
        tct('[action] spike protection for [project]', {
          action: newValue ? t('Enabled') : t('Disabled'),
          project: project.slug,
        })
      );
      trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_PROJECT_TOGGLED, {
        organization,
        subscription,
        project_id: project.id,
        value: newValue,
        view: analyticsView,
      });
      onChange?.(newValue, event);
    } catch {
      setIsToggleEnabled(!newValue);
      addErrorMessage(SPIKE_PROTECTION_ERROR_MESSAGE);
    }
  }

  const identifier = `${project.slug}-spike-protection-toggle`;
  return (
    <BooleanField
      onChange={toggleFeature}
      value={isToggleEnabled}
      data-test-id={identifier}
      name={identifier}
      disabled={disabled}
      {...fieldProps}
    />
  );
}

export default withSubscription(SpikeProtectionProjectToggle);
