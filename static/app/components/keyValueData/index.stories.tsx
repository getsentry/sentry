import {Fragment} from 'react';
import {type Theme, useTheme} from '@emotion/react';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconCodecov, IconEdit, IconSentry, IconSettings} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('KeyValueData', story => {
  story('Usage', () => (
    <CodeSnippet language="js">
      import KeyValueData from 'sentry/components/keyValueData';
    </CodeSnippet>
  ));
  story('<KeyValueData.Content />', () => {
    const theme = useTheme();
    const contentItems = generateContentItems(theme);

    return (
      <Fragment>
        <p>
          <code>{'<KeyValueData.Content/>'}</code> will often be generated as a result of
          creating a <code>{'<KeyValueData.Card/>'}</code>
          component. These allow for customizing every item rendered in the card
          individually.
        </p>
        <h4>Props</h4>
        <ul>
          <li>
            <code>item</code> - A <code>KeyValueListDataItem</code> blob from the previous
            Key Value component. If a <code>subjectNode</code> is presented, we use that
            instead of the <code>subject</code>. If <code>subjectNode</code> is null, the
            value will span the full length. The only displayed action by default is{' '}
            <code>item.action.link</code>.
          </li>
          <li>
            <code>disableLink</code> - Disable automatic links from{' '}
            <code>item.action.link</code>
          </li>
          <li>
            <code>disableFormattedData</code> - Disable structured data and forces
            string/component
          </li>
          <li>
            <code>errors</code> - Errors to display at the end of the row
          </li>
          <li>
            <code>meta</code> - Metadata for adding annotations like redactions/filters
          </li>
        </ul>
        <KeyValueData.Card contentItems={contentItems} />
      </Fragment>
    );
  });

  story('<KeyValueData.Card />', () => {
    const theme = useTheme();
    const contentItems = generateContentItems(theme);

    return (
      <Fragment>
        <p>
          Display a set of key-value data as a card. Creates structured data for
          lists/dicts and changes format based on value type. Any of the customization
          from <code>KeyValueData.Content</code> is available here, and display many of
          these cards using <code>KeyValueData.Container</code>.
        </p>
        <h4>Props</h4>
        <ul>
          <li>
            <code>contentItems</code> - A list of <code>KeyValueData.ContentProps</code>{' '}
            objects, which will be turned into the rows for the card.
          </li>
          <li>
            <code>title</code> - string or component to display above the data set
          </li>
          <li>
            <code>truncateLength</code> - length at which to display a show more toggle.
          </li>
          <li>
            <code>sortAlphabetically</code> - Enable to sort items based on{' '}
            <code>subject</code>
          </li>
        </ul>
        <KeyValueData.Container>
          <KeyValueData.Card
            title="Dataset Title"
            contentItems={contentItems.slice(0, 3)}
          />
          <KeyValueData.Card
            title="Alphabetical Sort"
            contentItems={contentItems}
            sortAlphabetically
          />
          <KeyValueData.Card
            title={
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: theme.green400,
                }}
              >
                <IconSettings /> Custom Title Node
              </span>
            }
            contentItems={contentItems.slice(4, 9)}
          />
          <KeyValueData.Card
            title="Truncate at Length 4"
            contentItems={contentItems}
            truncateLength={4}
          />
        </KeyValueData.Container>
      </Fragment>
    );
  });

  story('<KeyValueData.Container />', () => {
    const theme = useTheme();
    const contentItems = generateContentItems(theme);

    return (
      <Fragment>
        <p>
          <code>{'<KeyValueData.Container/>'}</code> can be used in combination with{' '}
          <code>{'<KeyValueData.Card/>'}</code> components to create a 'masonry' style
          layout for space efficiency. They leverage the{' '}
          <code>useIssueDetailsColumnCount</code> hook to distribute cards into the
          available space evenly. They don't accept any props, and just require{' '}
          <code>children</code>.
        </p>
        <p>
          <CodeSnippet language="jsx">
            {`<KeyValueData.Container>
  <KeyValueData.Card ... />
  <KeyValueData.Card ... />
  <KeyValueData.Card ... />
</KeyValueData.Container>`}
          </CodeSnippet>
        </p>
        <p>
          It should be noted that the number of items per card, or content size is not
          factored in, and can lead to some inconsistencies.
        </p>
        <KeyValueData.Container>
          <KeyValueData.Card contentItems={contentItems.slice(0, 2)} />
          <KeyValueData.Card contentItems={contentItems.slice(4, 6)} />
          <KeyValueData.Card contentItems={contentItems.slice(1, 6)} />
          <KeyValueData.Card contentItems={contentItems.slice(0, 8)} />
          <KeyValueData.Card contentItems={contentItems.slice(2, 5)} />
        </KeyValueData.Container>
      </Fragment>
    );
  });
});

function generateContentItems(theme: Theme): KeyValueDataContentProps[] {
  return [
    {
      item: {
        key: 'string',
        subject: 'string',
        value: 'This is an example of a string.',
      },
    },
    {
      item: {
        key: 'number',
        subject: 'number',
        value: 20481027,
      },
    },
    {
      item: {
        key: 'array',
        subject: 'array',
        value: ['entry 0', 1, null, ['3'], {value: 4}] as any,
      },
    },
    {
      item: {
        key: 'dict',
        subject: 'dict',
        value: {primary: 'alpha', secondary: 2} as any,
      },
    },
    {
      item: {
        key: 'disabled-formatted-dict',
        subject: 'raw dict',
        value: {primary: 'alpha', secondary: 2} as any,
      },
      disableFormattedData: true,
    },
    {
      item: {
        key: 'null',
        subject: 'null',
        value: null,
      },
    },
    {
      item: {
        key: 'undefined',
        subject: 'undefined',
        value: undefined,
      },
    },
    {
      item: {
        key: 'external-url',
        subject: 'external url',
        value: 'https://sentry.io',
      },
    },
    {
      item: {
        key: 'action-link',
        subject: 'action link',
        value: 'Click to go to Sentry.io',
        action: {
          link: 'https://sentry.io',
        },
      },
    },
    {
      item: {
        key: 'disabled-action-link',
        subject: 'disabled action link',
        value: 'Click to go to Sentry.io',
        action: {
          link: 'https://sentry.io',
        },
      },
      disableLink: true,
    },
    {
      item: {
        key: 'action-button',
        subject: 'action button',
        value: 'I show a button on hover',
        actionButton: (
          <Button
            aria-label="Click me"
            borderless
            size="zero"
            icon={<IconEdit size="xs" />}
          />
        ),
      },
    },
    {
      item: {
        key: 'subject-node',
        subject: 'custom subject node',
        subjectNode: (
          <span style={{color: theme.purple300}}>
            Custom Subject Node <IconSentry />
          </span>
        ),
        value: (
          <span style={{color: theme.pink300}}>
            Custom Value Node <IconCodecov />
          </span>
        ),
      },
    },
    {
      item: {
        key: 'null-subject-node',
        subject: 'null-subject-node',
        subjectNode: null,
        value: (
          <Alert type="warning" showIcon>
            Custom value can also span full length
          </Alert>
        ),
      },
    },
    {
      item: {
        key: 'redacted-value',
        subject: 'redacted value',
        value: '',
      },
      meta: {
        '': {
          chunks: [
            {
              remark: 'x',
              rule_id: 'project:0',
              text: '',
              type: 'redaction',
            },
          ],
          len: 1,
          rem: [['project:0', 'x', 0, 0]],
        },
      },
    },
    {
      item: {
        key: 'error-value',
        subject: 'error value',
        value: '',
      },
      meta: {
        '': {
          err: [
            [
              'invalid_data',
              {
                reason: 'This is a reason for the error',
              },
            ],
          ],
          val: 'error value',
        },
      },
      errors: [
        [
          'invalid_data',
          {
            reason: 'This is a reason for the error',
          },
        ],
      ],
    },
  ];
}
