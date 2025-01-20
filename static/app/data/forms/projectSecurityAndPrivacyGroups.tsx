import {hasEveryAccess} from 'sentry/components/acl/access';
import type {JsonFormObject} from 'sentry/components/forms/types';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/security-and-privacy/';

// Check if a field has been set AND IS TRUTHY at the organization level.
const hasOrgOverride = ({
  organization,
  name,
}: {
  name: string;
  organization: Organization;
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
}) => organization[name];

function hasProjectWriteAndOrgOverride({
  organization,
  project,
  name,
}: {
  name: string;
  organization: Organization;
  project: Project;
}) {
  if (hasOrgOverride({organization, name})) {
    return true;
  }

  return !hasEveryAccess(['project:write'], {organization, project});
}

function projectWriteAndOrgOverrideDisabledReason({
  organization,
  name,
  project,
}: {
  name: string;
  organization: Organization;
  project: Project;
}) {
  if (hasOrgOverride({organization, name})) {
    return t(
      "This option is enforced by your organization's settings and cannot be customized per-project."
    );
  }

  if (!hasEveryAccess(['project:write'], {organization, project})) {
    return t("You do not have permission to modify this project's setting.");
  }

  return null;
}

const formGroups: JsonFormObject[] = [
  {
    title: t('Security & Privacy'),
    fields: [
      {
        disabled: hasProjectWriteAndOrgOverride,
        disabledReason: projectWriteAndOrgOverrideDisabledReason,
        name: 'storeCrashReports',
        type: 'select',
        label: t('Store Minidumps As Attachments'),
        help: ({organization}) =>
          tct(
            'Store minidumps as attachments for improved processing and download in issue details. Overrides [organizationSettingsLink: organization settings].',
            {
              organizationSettingsLink: (
                <Link to={`/settings/${organization.slug}/security-and-privacy/`} />
              ),
            }
          ),
        visible: ({features}) => features.has('event-attachments'),
        placeholder: ({organization, value}) => {
          // empty value means that this project should inherit organization settings
          if (value === '') {
            return tct('Inherit organization settings ([organizationValue])', {
              organizationValue: formatStoreCrashReports(organization.storeCrashReports),
            });
          }

          // HACK: some organization can have limit of stored crash reports a number that's not in the options (legacy reasons),
          // we therefore display it in a placeholder
          return formatStoreCrashReports(value);
        },
        choices: ({organization}) =>
          getStoreCrashReportsValues(SettingScope.PROJECT).map(value => [
            value,
            formatStoreCrashReports(value, organization.storeCrashReports),
          ]),
      },
    ],
  },
  {
    title: t('Data Scrubbing'),
    fields: [
      {
        name: 'dataScrubber',
        type: 'boolean',
        label: t('Data Scrubber'),
        disabled: hasProjectWriteAndOrgOverride,
        disabledReason: projectWriteAndOrgOverrideDisabledReason,
        help: t('Enable server-side data scrubbing'),
        'aria-label': t('Enable server-side data scrubbing'),
        // `props` are the props given to FormField
        setValue: (val, props) => props.organization?.[props.name] || val,
        confirm: {
          false: t('Are you sure you want to disable server-side data scrubbing?'),
        },
      },
      {
        name: 'dataScrubberDefaults',
        type: 'boolean',
        disabled: hasProjectWriteAndOrgOverride,
        disabledReason: projectWriteAndOrgOverrideDisabledReason,
        label: t('Use Default Scrubbers'),
        help: t(
          'Apply default scrubbers to prevent things like passwords and credit cards from being stored'
        ),
        'aria-label': t(
          'Enable to apply default scrubbers to prevent things like passwords and credit cards from being stored'
        ),
        // `props` are the props given to FormField
        setValue: (val, props) => props.organization?.[props.name] || val,
        confirm: {
          false: t('Are you sure you want to disable using default scrubbers?'),
        },
      },
      {
        name: 'scrubIPAddresses',
        type: 'boolean',
        disabled: hasProjectWriteAndOrgOverride,
        disabledReason: projectWriteAndOrgOverrideDisabledReason,
        // `props` are the props given to FormField
        setValue: (val, props) => props.organization?.[props.name] || val,
        label: t('Prevent Storing of IP Addresses'),
        help: t('Preventing IP addresses from being stored for new events'),
        'aria-label': t(
          'Enable to prevent IP addresses from being stored for new events'
        ),
        confirm: {
          false: t('Are you sure you want to disable scrubbing IP addresses?'),
        },
      },
      {
        name: 'sensitiveFields',
        type: 'string',
        multiline: true,
        autosize: true,
        maxRows: 10,
        rows: 1,
        placeholder: t('email'),
        label: t('Additional Sensitive Fields'),
        help: t(
          'Additional field names to match against when scrubbing data. Separate multiple entries with a newline'
        ),
        'aria-label': t(
          'Enter additional field names to match against when scrubbing data. Separate multiple entries with a newline'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => convertMultilineFieldValue(val),
      },
      {
        name: 'safeFields',
        type: 'string',
        multiline: true,
        autosize: true,
        maxRows: 10,
        rows: 1,
        placeholder: t('business-email'),
        label: t('Safe Fields'),
        help: t(
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline'
        ),
        'aria-label': t(
          'Enter field names which data scrubbers should ignore. Separate multiple entries with a newline'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => convertMultilineFieldValue(val),
      },
    ],
  },
];

export default formGroups;
