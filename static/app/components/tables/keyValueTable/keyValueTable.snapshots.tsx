import {Button} from '@sentry/scraps/button';

import {KeyValueTable, KeyValueTableRow} from './keyValueTable';
import {KeyValueTableCard} from './keyValueTableCard';
import {KeyValueTableDataList} from './keyValueTableDataList';
import {
  KeyValueTableDataRow,
  type KeyValueTableDataRowProps,
} from './keyValueTableDataRow';

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
  it.snapshot(
    'inline',
    () => (
      <div style={{padding: 8, width: 400}}>
        <KeyValueTable>
          <KeyValueTableRow keyName="Created" value="Jan 15, 2025" />
          <KeyValueTableRow keyName="Version" value="2.1.0" />
          <KeyValueTableRow keyName="Environment" value="production" />
        </KeyValueTable>
      </div>
    ),
    {tags: {area: 'core', variant: 'inline'}}
  );

  it.snapshot.each<'error' | 'warning'>(['error', 'warning'])(
    'inline-%s',
    (type: 'error' | 'warning') => (
      <div style={{padding: 8, width: 400}}>
        <KeyValueTable>
          <KeyValueTableRow keyName="Status" value="Failing" type={type} />
          <KeyValueTableRow keyName="Version" value="2.1.0" />
        </KeyValueTable>
      </div>
    ),
    (type: 'error' | 'warning') => ({tags: {area: 'core', variant: 'inline', type}})
  );

  it.snapshot(
    'card',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableCard
          title="Dataset KeyValueTableCardTitle"
          contentItems={contentItems}
        />
      </div>
    ),
    {tags: {area: 'core', variant: 'card'}}
  );

  it.snapshot(
    'card-truncated',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableCard
          title="Truncated"
          contentItems={contentItems}
          truncateLength={2}
        />
      </div>
    ),
    {tags: {area: 'core', variant: 'card'}}
  );

  it.snapshot(
    'card-children',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableCard title="Body" contentItems={contentItems.slice(0, 2)}>
          <pre>{'{\n  "primary": "alpha"\n}'}</pre>
        </KeyValueTableCard>
      </div>
    ),
    {tags: {area: 'core', variant: 'card'}}
  );

  it.snapshot(
    'card-row-states',
    () => (
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
    ),
    {tags: {area: 'core', variant: 'card'}}
  );

  it.snapshot(
    'card-expand-left',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableCard contentItems={contentItems} expandLeft />
      </div>
    ),
    {tags: {area: 'core', variant: 'card'}}
  );

  it.snapshot(
    'card-standalone-row',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableDataRow
          item={{key: 'string', subject: 'string', value: 'A plain string value.'}}
        />
      </div>
    ),
    {tags: {area: 'core', variant: 'card'}}
  );

  it.snapshot(
    'list',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableDataList data={listData} />
      </div>
    ),
    {tags: {area: 'core', variant: 'list'}}
  );

  it.snapshot(
    'list-context-data',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableDataList data={listData} isContextData />
      </div>
    ),
    {tags: {area: 'core', variant: 'list'}}
  );

  it.snapshot(
    'list-multi-value',
    () => (
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
    ),
    {tags: {area: 'core', variant: 'list'}}
  );
});
