import {ThemeProvider} from '@emotion/react';

import {Button} from '@sentry/scraps/button';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {KeyValueTable, KeyValueTableRow} from './keyValueTable';
import {KeyValueTableCard} from './keyValueTableCard';
import {KeyValueTableDataList} from './keyValueTableDataList';
import {
  KeyValueTableDataRow,
  type KeyValueTableDataRowProps,
} from './keyValueTableDataRow';

const themes = {light: lightTheme, dark: darkTheme};

const contentItems: KeyValueTableDataRowProps[] = [
  {item: {key: 'string', subject: 'string', value: 'A plain string value.'}},
  {item: {key: 'number', subject: 'number', value: 20481027}},
  {item: {key: 'dict', subject: 'dict', value: {primary: 'alpha', secondary: 2}}},
  {item: {key: 'null', subject: 'null', value: null}},
  {item: {key: 'nested', subject: 'nested', value: {region: 'us', retries: 3}}},
];

const listData = [
  {key: 'browser', subject: 'Browser', value: 'Chrome 131.0.0'},
  {key: 'os', subject: 'OS', value: 'macOS 15.1'},
  {key: 'runtime', subject: 'Runtime', value: {name: 'node', version: '22.11.0'}},
];

describe('KeyValueTable', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'inline',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 400}}>
            <KeyValueTable>
              <KeyValueTableRow keyName="Created" value="Jan 15, 2025" />
              <KeyValueTableRow keyName="Version" value="2.1.0" />
              <KeyValueTableRow keyName="Environment" value="production" />
            </KeyValueTable>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'inline'}}
    );

    it.snapshot.each<'error' | 'warning'>(['error', 'warning'])(
      'inline-%s',
      type => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 400}}>
            <KeyValueTable>
              <KeyValueTableRow keyName="Status" value="Failing" type={type} />
              <KeyValueTableRow keyName="Version" value="2.1.0" />
            </KeyValueTable>
          </div>
        </ThemeProvider>
      ),
      type => ({tags: {area: 'core', variant: 'inline', type: String(type)}})
    );

    it.snapshot(
      'card',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableCard
              title="Dataset KeyValueTableCardTitle"
              contentItems={contentItems}
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'card'}}
    );

    it.snapshot(
      'card-truncated',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableCard
              title="Truncated"
              contentItems={contentItems}
              truncateLength={2}
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'card'}}
    );

    it.snapshot(
      'card-row-states',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableCard
              contentItems={[
                {
                  item: {
                    key: 'action-button',
                    subject: 'action button',
                    value: 'Hover to reveal',
                    actionButton: <Button size="zero">{'Edit'}</Button>,
                    actionButtonAlwaysVisible: true,
                  },
                },
                {
                  item: {key: 'suspect', subject: 'suspect flag', value: 'true'},
                  isSuspectFlag: true,
                },
                {
                  item: {key: 'errored', subject: 'errored', value: ''},
                  errors: [['invalid_data', {reason: 'This is a reason'}]],
                },
                {
                  item: {
                    key: 'full-width',
                    subject: 'full width',
                    subjectNode: null,
                    value: 'Spans both columns',
                  },
                },
              ]}
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'card'}}
    );

    it.snapshot(
      'card-expand-left',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableCard contentItems={contentItems} expandLeft />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'card'}}
    );

    it.snapshot(
      'card-standalone-row',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableDataRow item={contentItems[0]!.item} />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'card'}}
    );

    it.snapshot(
      'list',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableDataList data={listData} />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'list'}}
    );

    it.snapshot(
      'list-context-data',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableDataList data={listData} isContextData />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'list'}}
    );

    it.snapshot(
      'list-multi-value',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <KeyValueTableDataList
              shouldSort={false}
              data={[
                {
                  key: 'tags',
                  subject: 'Tags',
                  value: ['alpha', 'beta', 'gamma'],
                  isMultiValue: true,
                },
                {
                  key: 'action-button',
                  subject: 'Action',
                  value: 'With a button',
                  actionButton: <Button size="zero">{'Edit'}</Button>,
                },
              ]}
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core', variant: 'list'}}
    );
  });
});
