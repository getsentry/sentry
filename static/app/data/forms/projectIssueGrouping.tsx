import {Fragment} from 'react';
import styled from '@emotion/styled';

import {GroupingConfigItem} from 'sentry/components/events/groupingInfo';
import {Field} from 'sentry/components/forms/type';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import marked from 'sentry/utils/marked';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/issue-grouping/';

const groupingConfigField: Field = {
  name: 'groupingConfig',
  type: 'select',
  label: t('Grouping Config'),
  saveOnBlur: false,
  saveMessageAlertType: 'info',
  saveMessage: t(
    'Changing grouping config will apply to future events only (can take up to a minute).'
  ),
  selectionInfoFunction: args => {
    const {groupingConfigs, value} = args;
    const selection = groupingConfigs.find(({id}) => id === value);
    const changelog = selection?.changelog || '';
    if (!changelog) {
      return null;
    }
    return (
      <Changelog>
        <ChangelogTitle>
          {tct('New in version [version]', {version: selection.id})}:
        </ChangelogTitle>
        <div dangerouslySetInnerHTML={{__html: marked(changelog)}} />
      </Changelog>
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
};

export const fields: Record<string, Field> = {
  fingerprintingRules: {
    name: 'fingerprintingRules',
    type: 'string',
    label: t('Fingerprint Rules'),
    hideLabel: true,
    placeholder: t(
      'error.type:MyException -> fingerprint-value\nstack.function:some_panic_function -> fingerprint-value'
    ),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t(
      'Changing fingerprint rules will apply to future events only (can take up to a minute).'
    ),
    formatMessageValue: false,
    help: () => (
      <Fragment>
        <RuleDescription>
          {tct(
            `This can be used to modify the fingerprint rules on the server with custom rules.
        Rules follow the pattern [pattern]. To learn more about fingerprint rules, [docs:read the docs].`,
            {
              pattern: <code>matcher:glob -&gt; fingerprint, values</code>,
              docs: (
                <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/fingerprint-rules/" />
              ),
            }
          )}
        </RuleDescription>
        <RuleExample>
          {`# force all errors of the same type to have the same fingerprint
error.type:DatabaseUnavailable -> system-down
# force all memory allocation errors to be grouped together
stack.function:malloc -> memory-allocation-error`}
        </RuleExample>
      </Fragment>
    ),
    visible: true,
  },
  groupingEnhancements: {
    name: 'groupingEnhancements',
    type: 'string',
    label: t('Stack Trace Rules'),
    hideLabel: true,
    placeholder: t(
      'stack.function:raise_an_exception ^-group\nstack.function:namespace::* +app'
    ),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t(
      'Changing stack trace rules will apply to future events only (can take up to a minute).'
    ),
    formatMessageValue: false,
    help: () => (
      <Fragment>
        <RuleDescription>
          {tct(
            `This can be used to enhance the grouping algorithm with custom rules.
        Rules follow the pattern [pattern]. To learn more about stack trace rules, [docs:read the docs].`,
            {
              pattern: <code>matcher:glob [v^]?[+-]flag</code>,
              docs: (
                <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/stack-trace-rules/" />
              ),
            }
          )}
        </RuleDescription>
        <RuleExample>
          {`# remove all frames above a certain function from grouping
stack.function:panic_handler ^-group
# mark all functions following a prefix in-app
stack.function:mylibrary_* +app`}
        </RuleExample>
      </Fragment>
    ),
    validate: () => [],
    visible: true,
  },
  groupingConfig: groupingConfigField,
  secondaryGroupingConfig: {
    ...groupingConfigField,
    name: 'secondaryGroupingConfig',
    label: t('Fallback/Secondary Grouping Config'),
    help: t(
      'Sets the secondary grouping algorithm that should be run in addition to avoid creating too many new groups. Controlled by expiration date below.'
    ),
    saveMessage: t(
      'Changing the secondary grouping strategy will affect how many new issues are created.'
    ),
  },
  secondaryGroupingExpiry: {
    name: 'secondaryGroupingExpiry',
    type: 'number',
    label: t('Expiration date of secondary grouping'),
    help: t(
      'If this UNIX timestamp is in the past, the secondary grouping configuration stops applying automatically.'
    ),
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t(
      'Changing the expiration date will affect how many new issues are created.'
    ),
  },
};

const RuleDescription = styled('div')`
  margin-bottom: ${space(1)};
  margin-top: -${space(1)};
  margin-right: 36px;
`;

const RuleExample = styled('pre')`
  margin-bottom: ${space(1)};
  margin-right: 36px;
`;

const Changelog = styled('div')`
  position: relative;
  top: -1px;
  margin-bottom: -1px;
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  background: ${p => p.theme.backgroundSecondary};
  font-size: ${p => p.theme.fontSizeMedium};

  &:last-child {
    border: 0;
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

const ChangelogTitle = styled('h3')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.75)} !important;
`;
