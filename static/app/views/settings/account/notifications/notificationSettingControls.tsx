import {Fragment, type ReactNode} from 'react';
import type {UseMutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';

import type {NotificationOptionsObject} from './constants';
import {UnlinkedAlert} from './unlinkedAlert';

/**
 * Warns that Slack notifications fall back to email for organizations where the
 * user hasn't linked their Slack account.
 */
export function UnlinkedSlackAlerts({
  providers,
  unlinkedSlackOrgs,
  unlinkedSlackStagingOrgs,
}: {
  providers: string[];
  unlinkedSlackOrgs: OrganizationSummary[];
  unlinkedSlackStagingOrgs: OrganizationSummary[];
}) {
  return (
    <Fragment>
      {providers.includes('slack') && unlinkedSlackOrgs.length > 0 ? (
        <UnlinkedAlert organizations={unlinkedSlackOrgs} />
      ) : null}
      {providers.includes('slack_staging') && unlinkedSlackStagingOrgs.length > 0 ? (
        <UnlinkedAlert organizations={unlinkedSlackStagingOrgs} />
      ) : null}
    </Fragment>
  );
}

/**
 * Auto-saving on/off switch for a notification setting. Saves the same
 * always/never values as the dropdown settings.
 */
export function NotificationSettingToggle({
  name,
  label,
  help,
  initialValue,
  mutationOptions,
}: {
  help: ReactNode;
  initialValue: string | undefined;
  label: ReactNode;
  mutationOptions: UseMutationOptions<
    NotificationOptionsObject,
    Error,
    Record<string, string>
  >;
  name: string;
}) {
  const schema = z.object({
    [name]: z.boolean().transform(on => (on ? 'always' : 'never')),
  });

  return (
    <AutoSaveForm
      name={name}
      schema={schema}
      initialValue={initialValue !== 'never'}
      mutationOptions={mutationOptions}
    >
      {field => (
        <field.Layout.Row label={label} hintText={help}>
          <Flex justify="end">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </Flex>
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

/**
 * Label for the delivery method button, e.g. "Email & Slack", or "None" when
 * nothing is selected.
 */
function getProviderTriggerLabel(
  providerChoices: Array<{label: string; value: string}>,
  selectedProviders: string[]
): string {
  const labels = providerChoices
    .filter(choice => selectedProviders.includes(choice.value))
    .map(choice => choice.label);

  if (labels.length === 0) {
    return t('None');
  }
  return labels.reduce((joined, label) => t('%s & %s', joined, label));
}

/**
 * Auto-saving multi-select for where a notification type is delivered (email,
 * Slack, ...).
 */
export function NotificationProviderSelect({
  label,
  hintText,
  allowEmpty = false,
  initialValue,
  providerChoices,
  mutationOptions,
  unlinkedSlackOrgs,
  unlinkedSlackStagingOrgs,
}: {
  hintText: ReactNode;
  initialValue: string[];
  label: ReactNode;
  mutationOptions: UseMutationOptions<unknown, Error, {provider: string[]}>;
  providerChoices: Array<{label: string; value: string}>;
  unlinkedSlackOrgs: OrganizationSummary[];
  unlinkedSlackStagingOrgs: OrganizationSummary[];
  /**
   * Allow saving with no provider selected, for notifications that are also
   * shown somewhere else (like the Inbox).
   */
  allowEmpty?: boolean;
}) {
  const schema = z.object({
    provider: allowEmpty ? z.array(z.string()) : z.array(z.string()).min(1),
  });

  return (
    <AutoSaveForm
      name="provider"
      schema={schema}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {field => (
        <Fragment>
          <UnlinkedSlackAlerts
            providers={field.state.value}
            unlinkedSlackOrgs={unlinkedSlackOrgs}
            unlinkedSlackStagingOrgs={unlinkedSlackStagingOrgs}
          />
          <field.Layout.Row label={label} hintText={hintText}>
            <Flex justify="end">
              <field.CompactSelect
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={providerChoices}
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} style={{width: 'auto'}}>
                    {getProviderTriggerLabel(providerChoices, field.state.value)}
                  </OverlayTrigger.Button>
                )}
              />
            </Flex>
          </field.Layout.Row>
        </Fragment>
      )}
    </AutoSaveForm>
  );
}
