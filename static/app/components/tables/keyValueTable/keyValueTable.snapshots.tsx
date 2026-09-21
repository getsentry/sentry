import {Button} from '@sentry/scraps/button';

import {KeyValueTable, KeyValueTableRow} from './keyValueTable';
import {KeyValueTableCard} from './keyValueTableCard';
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
});
