import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {Field} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/issue-grouping/';

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
