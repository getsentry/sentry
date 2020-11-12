import React from 'react';

import {t, tct} from 'app/locale';
import HintPanelItem from 'app/components/panels/hintPanelItem';
import marked from 'app/utils/marked';
import ExternalLink from 'app/components/links/externalLink';
import {GroupingConfigItem} from 'app/components/events/groupingInfo';
import {Field} from 'app/views/settings/components/forms/type';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/';

export const fields: Record<string, Field> = {
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
        <HintPanelItem style={{position: 'relative', top: '-1px', marginBottom: '-1px'}}>
          <div>
            <h2 style={{marginBottom: '6px', fontSize: '14px'}}>
              {tct('New in version [version]', {version: selection.id})}:
            </h2>
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
        <HintPanelItem style={{position: 'relative', top: '-1px', marginBottom: '-1px'}}>
          <div>
            <h2 style={{marginBottom: '6px', fontSize: '14px'}}>
              {tct('New in version [version]', {version: selection.id})}:
            </h2>
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
    // label: t('Stacktrace Rules'),
    label: null,
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
    saveMessage: t('Changing grouping enhancements will apply to future events only.'),
    formatMessageValue: false,
    help: (
      <React.Fragment>
        <div style={{marginBottom: 8, marginTop: -8}}>
          {tct(
            `This can be used to enhance the grouping algorithm with custom rules.
        Rules follow the pattern [pattern]. [docs:Read the docs] for more information.`,
            {
              pattern: <code>matcher:glob [^v]?[+-]flag</code>,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Fdata-management%2Fevent-grouping%2Fgrouping-enhancements%2F" />
              ),
            }
          )}
        </div>
        <pre style={{marginBottom: 8}}>
          {'# remove all frames above a certain function from grouping\n' +
            'stack.function:panic_handler      ^-group\n' +
            '# mark all functions following a prefix in-app\n' +
            'stack.function:mylibrary_*        +app\n'}
        </pre>
      </React.Fragment>
    ),
    validate: () => [],
    visible: true,
  },
  fingerprintingRules: {
    name: 'fingerprintingRules',
    type: 'string',
    // label: t('Fingerprint Rules'),
    label: null,
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
    saveMessage: t('Changing fingerprinting rules will apply to future events only.'),
    formatMessageValue: false,
    help: (
      <React.Fragment>
        <div style={{marginBottom: 8, marginTop: -8}}>
          {tct(
            `This can be used to modify the fingerprinting rules on the server with custom rules.
        Rules follow the pattern [pattern]. [docs:Read the docs] for more information.`,
            {
              pattern: <code>matcher:glob -&gt; fingerprint, values</code>,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Fdata-management%2Fevent-grouping%2Fserver-side-fingerprinting%2F" />
              ),
            }
          )}
        </div>
        <pre style={{marginBottom: 8}}>
          {'# force all errors of the same type to have the same fingerprint\n' +
            'error.type:DatabaseUnavailable -> system-down\n' +
            '# force all memory allocation errors to be grouped together\n' +
            'stack.function:malloc -> memory-allocation-error\n'}
        </pre>
      </React.Fragment>
    ),
    visible: true,
  },
};
