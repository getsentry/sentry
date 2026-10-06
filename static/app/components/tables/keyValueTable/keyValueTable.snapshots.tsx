import {Button} from '@sentry/scraps/button';

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
        <KeyValueTableCard contentItems={contentItems} itemProps={{expandLeft: true}} />
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
    'card-label-variant',
    () => (
      <div style={{padding: 8, width: 500}}>
        <KeyValueTableCard contentItems={contentItems} variant="label" />
      </div>
    ),
    {tags: {area: 'core', variant: 'card'}}
  );
});
