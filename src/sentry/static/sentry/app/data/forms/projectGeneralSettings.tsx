import React from 'react';
import styled from '@emotion/styled';

import {extractMultilineFields} from 'app/utils';
import {t, tct, tn} from 'app/locale';
import HintPanelItem from 'app/components/panels/hintPanelItem';
import PlatformIcon from 'app/components/platformIcon';
import getDynamicText from 'app/utils/getDynamicText';
import marked from 'app/utils/marked';
import platforms from 'app/data/platforms';
import slugify from 'app/utils/slugify';
import {
  STORE_CRASH_REPORTS_VALUES,
  formatStoreCrashReports,
} from 'app/utils/crashReports';
import space from 'app/styles/space';
import {GroupingConfigItem} from 'app/components/events/groupingInfo';
import {Field} from 'app/views/settings/components/forms/type';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/';

const getResolveAgeAllowedValues = () => {
  let i = 0;
  const values: number[] = [];
  while (i <= 720) {
    values.push(i);
    if (i < 12) {
      i += 1;
    } else if (i < 24) {
      i += 3;
    } else if (i < 36) {
      i += 6;
    } else if (i < 48) {
      i += 12;
    } else {
      i += 24;
    }
  }
  return values;
};

const RESOLVE_AGE_ALLOWED_VALUES = getResolveAgeAllowedValues();

const ORG_DISABLED_REASON = t(
  "This option is enforced by your organization's settings and cannot be customized per-project."
);

// Check if a field has been set AND IS TRUTHY at the organization level.
const hasOrgOverride = ({organization, name}) => organization[name];

export const fields: {[key: string]: Field} = {
  slug: {
    name: 'slug',
    type: 'string',
    required: true,
    label: t('Name'),
    placeholder: t('my-service-name'),
    help: t('A unique ID used to identify this project'),
    transformInput: slugify,

    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t('You will be redirected to the new project slug after saving'),
  },

  platform: {
    name: 'platform',
    type: 'array',
    label: t('Platform'),
    choices: () =>
      platforms.map(({id, name}) => [
        id,
        <PlatformWrapper key={id}>
          <StyledPlatformIcon platform={id} size="20" />
          {name}
        </PlatformWrapper>,
      ]),
    help: t('The primary platform for this project, used only for aesthetics'),
  },

  subjectPrefix: {
    name: 'subjectPrefix',
    type: 'string',
    label: t('Subject Prefix'),
    placeholder: t('e.g. [my-org]'),
    help: t('Choose a custom prefix for emails from this project'),
  },

  resolveAge: {
    name: 'resolveAge',
    type: 'range',
    allowedValues: RESOLVE_AGE_ALLOWED_VALUES,
    label: t('Auto Resolve'),
    help: t(
      "Automatically resolve an issue if it hasn't been seen for this amount of time"
    ),
    formatLabel: val => {
      val = Number(val);
      if (val === 0) {
        return t('Disabled');
      }

      if (val > 23 && val % 24 === 0) {
        // Based on allowed values, val % 24 should always be true
        val = val / 24;
        return tn('%s day', '%s days', val);
      }

      return tn('%s hour', '%s hours', val);
    },
    saveOnBlur: false,
    saveMessage: tct(
      '[Caution]: Enabling auto resolve will immediately resolve anything that has ' +
        'not been seen within this period of time. There is no undo!',
      {
        Caution: <strong>Caution</strong>,
      }
    ),
    saveMessageAlertType: 'warning',
  },

  groupingConfig: {
    name: 'groupingConfig',
    type: 'array',
    label: t('Grouping Config'),
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t('Changing grouping config will apply to future events only.'),
    selectionInfoFunction: args => {
      const {groupingConfigs, value} = args;
      const selection = groupingConfigs.find(({id}) => id === value);
      const changelog = (selection && selection.changelog) || '';
      if (!changelog) {
        return null;
      }
      return (
        <HintPanelItem>
          <div>
            <h2>{selection.id}:</h2>
            <div dangerouslySetInnerHTML={{__html: marked(changelog)}} />
          </div>
        </HintPanelItem>
      );
    },
    choices: ({groupingConfigs}) =>
      groupingConfigs.map(({id, hidden}) => [
        id.toString(),
        <GroupingConfigItem key={id} isHidden={hidden}>
          {id}
        </GroupingConfigItem>,
      ]),
    help: t('Sets the grouping algorithm to be used for new events.'),
    visible: ({features}) => features.has('set-grouping-config'),
  },
  groupingEnhancementsBase: {
    name: 'groupingEnhancementsBase',
    type: 'array',
    label: t('Grouping Enhancements Base'),
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t('Changing grouping enhancements will apply to future events only.'),
    selectionInfoFunction: args => {
      const {groupingEnhancementBases, value} = args;
      const selection = groupingEnhancementBases.find(({id}) => id === value);
      const changelog = (selection && selection.changelog) || '';
      if (!changelog) {
        return null;
      }
      return (
        <HintPanelItem>
          <div>
            <h2>{selection.id}:</h2>
            <div dangerouslySetInnerHTML={{__html: marked(changelog)}} />
          </div>
        </HintPanelItem>
      );
    },
    choices: ({groupingEnhancementBases}) =>
      groupingEnhancementBases.map(({id}) => [
        id.toString(),
        <GroupingConfigItem key={id}>{id}</GroupingConfigItem>,
      ]),
    help: t('The built-in base version of grouping enhancements.'),
    visible: ({features}) => features.has('set-grouping-config'),
  },
  groupingEnhancements: {
    name: 'groupingEnhancements',
    type: 'string',
    label: t('Custom Grouping Enhancements'),
    placeholder: t('function:raise_an_exception ^-group\nfunction:namespace::* +app'),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t('Changing grouping enhancements will apply to future events only.'),
    formatMessageValue: false,
    help: (
      <React.Fragment>
        <div style={{marginBottom: 3}}>
          {tct(
            `This can be used to enhance the grouping algorithm with custom rules.
        Rules follow the pattern [pattern].`,
            {
              pattern: <code>matcher:glob [^v]?[+-]flag</code>,
            }
          )}
        </div>
        <pre>
          {'# remove all frames above a certain function from grouping\n' +
            'function:panic_handler      ^-group\n' +
            '# mark all functions following a prefix in-app\n' +
            'function:mylibrary_*        +app\n'}
        </pre>
      </React.Fragment>
    ),
    validate: () => [],
    visible: ({features}) =>
      features.has('set-grouping-config') || features.has('tweak-grouping-config'),
  },
  fingerprintingRules: {
    name: 'fingerprintingRules',
    type: 'string',
    label: t('Server Side Fingerprinting'),
    placeholder: t(
      'type:MyException -> fingerprint-value\nfunction:some_panic_function -> fingerprint-value'
    ),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t('Changing fingerprinting rules will apply to future events only.'),
    formatMessageValue: false,
    help: (
      <React.Fragment>
        <div style={{marginBottom: 3}}>
          {tct(
            `This can be used to modify the fingerprinting rules on the server with custom rules.
        Rules follow the pattern [pattern].`,
            {
              pattern: <code>matcher:glob -> fingerprint, values</code>,
            }
          )}
        </div>
        <pre>
          {'# force all errors of the same type to have the same fingerprint\n' +
            'type:DatabaseUnavailable -> system-down\n' +
            '# force all memory allocation errors to be grouped together\n' +
            'family:native function:malloc -> memory-allocation-error\n'}
        </pre>
      </React.Fragment>
    ),
    visible: ({features}) =>
      features.has('set-grouping-config') || features.has('tweak-grouping-config'),
  },

  dataScrubber: {
    name: 'dataScrubber',
    type: 'boolean',
    label: t('Data Scrubber'),
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    help: t('Enable server-side data scrubbing'),
    // `props` are the props given to FormField
    setValue: (val, props) =>
      (props.organization && props.organization[props.name]) || val,
    confirm: {
      false: t('Are you sure you want to disable server-side data scrubbing?'),
    },
  },
  dataScrubberDefaults: {
    name: 'dataScrubberDefaults',
    type: 'boolean',
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    label: t('Use Default Scrubbers'),
    help: t(
      'Apply default scrubbers to prevent things like passwords and credit cards from being stored'
    ),
    // `props` are the props given to FormField
    setValue: (val, props) =>
      (props.organization && props.organization[props.name]) || val,
    confirm: {
      false: t('Are you sure you want to disable using default scrubbers?'),
    },
  },
  scrubIPAddresses: {
    name: 'scrubIPAddresses',
    type: 'boolean',
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) =>
      (props.organization && props.organization[props.name]) || val,
    label: t('Prevent Storing of IP Addresses'),
    help: t('Preventing IP addresses from being stored for new events'),
    confirm: {
      false: t('Are you sure you want to disable scrubbing IP addresses?'),
    },
  },
  sensitiveFields: {
    name: 'sensitiveFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    placeholder: t('email'),
    label: t('Additional Sensitive Fields'),
    help: t(
      'Additional field names to match against when scrubbing data. Separate multiple entries with a newline'
    ),
    getValue: val => extractMultilineFields(val),
    setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
  },
  safeFields: {
    name: 'safeFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    placeholder: t('business-email'),
    label: t('Safe Fields'),
    help: t(
      'Field names which data scrubbers should ignore. Separate multiple entries with a newline'
    ),
    getValue: val => extractMultilineFields(val),
    setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
  },
  storeCrashReports: {
    name: 'storeCrashReports',
    type: 'range',
    label: t('Store Native Crash Reports'),
    help: t(
      'Store native crash reports such as Minidumps for improved processing and download in issue details.  Overrides organization settings when enabled.'
    ),
    visible: ({features}) => features.has('event-attachments'),
    formatLabel: formatStoreCrashReports,
    allowedValues: STORE_CRASH_REPORTS_VALUES,
  },
  relayPiiConfig: {
    name: 'relayPiiConfig',
    type: 'string',
    label: t('Advanced datascrubber configuration'),
    placeholder: t('Paste a JSON configuration here.'),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    help: tct(
      'Advanced JSON-based configuration for datascrubbing. Applied in addition to the settings above. [learn_more:Learn more]',
      {
        learn_more: (
          <a href="https://docs.sentry.io/data-management/advanced-datascrubbing/" />
        ),
      }
    ),
    visible: ({features}) => features.has('datascrubbers-v2'),
    validate: ({id, form}) => {
      if (form[id] === '') {
        return [];
      }
      try {
        JSON.parse(form[id]);
      } catch (e) {
        return [[id, e.toString().replace(/^SyntaxError: JSON.parse: /, '')]];
      }
      return [];
    },
  },
  allowedDomains: {
    name: 'allowedDomains',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    placeholder: t('https://example.com or example.com'),
    label: t('Allowed Domains'),
    help: t('Separate multiple entries with a newline'),
    getValue: val => extractMultilineFields(val),
    setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
  },
  scrapeJavaScript: {
    name: 'scrapeJavaScript',
    type: 'boolean',
    // if this is off for the organization, it cannot be enabled for the project
    disabled: ({organization, name}) => !organization[name],
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] && val,
    label: t('Enable JavaScript source fetching'),
    help: t('Allow Sentry to scrape missing JavaScript source context when possible'),
  },
  securityToken: {
    name: 'securityToken',
    type: 'string',
    label: t('Security Token'),
    help: t(
      'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
    ),
    setValue: value => getDynamicText({value, fixed: '__SECURITY_TOKEN__'}),
  },
  securityTokenHeader: {
    name: 'securityTokenHeader',
    type: 'string',
    placeholder: t('X-Sentry-Token'),
    label: t('Security Token Header'),
    help: t(
      'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
    ),
  },
  verifySSL: {
    name: 'verifySSL',
    type: 'boolean',
    label: t('Verify TLS/SSL'),
    help: t('Outbound requests will verify TLS (sometimes known as SSL) connections'),
  },
};

const PlatformWrapper = styled('div')`
  display: flex;
  align-items: center;
`;
const StyledPlatformIcon = styled(PlatformIcon)`
  border-radius: 3px;
  margin-right: ${space(1)};
`;
