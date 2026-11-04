import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';

type BlockKitPayload = Record<string, unknown>;

const BLOCK_KIT_BUILDER_URL = 'https://app.slack.com/block-kit-builder/';

export function BlockKitExample({payload}: {payload: BlockKitPayload}) {
  return (
    <Stack gap="md">
      <Flex>
        <LinkButton
          href={`${BLOCK_KIT_BUILDER_URL}#${encodeURIComponent(JSON.stringify(payload))}`}
          size="sm"
          external
        >
          Open in Block Kit Builder
        </LinkButton>
      </Flex>
      <CodeBlock language="json">{JSON.stringify(payload, null, 2)}</CodeBlock>
    </Stack>
  );
}

export const issueAlertChannelPayload: BlockKitPayload = {
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':red_circle: <https://sentry.io/organizations/acme/issues/1/?referrer=slack&notification_uuid=example-uuid&workflow_id=1&alert_type=issue|*TypeError*>',
      },
      block_id: '{"issue":1,"workflow":1}',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'app/components/list.tsx in renderList',
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "```Cannot read properties of undefined (reading 'map')```",
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'environment: `production`  level: `error`  ',
      },
      block_id: '{"issue":1,"workflow":1,"block":"tags"}',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'State: *New*   First Seen: *Just now*',
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Resolve',
          },
          action_id: 'status::1::123',
          value: 'resolved',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Archive',
          },
          action_id: 'archive_dialog::1::123',
          value: 'archive_dialog',
        },
        {
          type: 'external_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select Assignee...',
            emoji: true,
          },
          action_id: 'assign::1::123',
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Project: <https://sentry.io/organizations/acme/issues/?project=123|javascript>    Alert: <https://sentry.io/organizations/acme/monitors/alerts/1/|Notify #feed-issues via Slack>    Short ID: JAVASCRIPT-1',
        },
      ],
    },
  ],
};

export const issueAlertPersonPayload: BlockKitPayload = {
  blocks: [
    {
      type: 'section',
      block_id: '{"issue":1,"workflow":1}',
      text: {
        type: 'mrkdwn',
        text: 'Alert triggered <https://sentry.io/organizations/acme/monitors/alerts/1/|New Issues>',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':large_blue_circle: :busts_in_silhouette: <https://sentry.io/organizations/acme/issues/1/?referrer=slack|*User Feedback: Urgent help needed to resolve major bug*>',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '<https://example.com/checkout|example.com/checkout>',
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "```The checkout button doesn't do anything when I click it```",
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'ai_categorization.label.0: `Bugs`  ',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'javascript | production | <https://sentry.io/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>',
        },
      ],
    },
  ],
};

export const issueLinkPreviewPayload: BlockKitPayload = {
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':red_circle: <https://sentry.io/organizations/acme/issues/1/events/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/?referrer=slack|*TypeError*>',
      },
      block_id: '{"issue":1}',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'app/components/list.tsx in renderList',
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "```Cannot read properties of undefined (reading 'map')```",
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'State: *New*   First Seen: *1 minute ago*',
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Resolve',
          },
          action_id: 'status::1::123',
          value: 'resolved',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Archive',
          },
          action_id: 'archive_dialog::1::123',
          value: 'archive_dialog',
        },
        {
          type: 'external_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select Assignee...',
            emoji: true,
          },
          action_id: 'assign::1::123',
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Project: <https://sentry.io/organizations/acme/issues/?project=123|javascript>    Alert: JAVASCRIPT-1    Short ID: JAVASCRIPT-1',
        },
      ],
    },
  ],
};

export const metricAlertCriticalPayload: BlockKitPayload = {
  attachments: [
    {
      color: '#FA4747',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '152 events in the last 5 minutes\n<!date^1767225600^Started: {date_pretty} at {time} | Sentry Incident>',
          },
        },
        {
          type: 'image',
          image_url: 'https://placehold.co/600x200/png?text=Metric+Alert+Chart',
          alt_text: 'Metric Alert Chart',
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Investigate with Seer',
              },
              action_id: 'seer_investigation_start::1::123',
              value: '{"groupId":1,"openPeriodId":1}',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Alert: <https://sentry.io/organizations/acme/monitors/alerts/1/|Checkout error rate>',
            },
          ],
        },
      ],
    },
  ],
};

export const metricAlertResolvedPayload: BlockKitPayload = {
  attachments: [
    {
      color: '#4DC771',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '3 events in the last 5 minutes\n<!date^1767225600^Started: {date_pretty} at {time} | Sentry Incident>',
          },
        },
        {
          type: 'image',
          image_url: 'https://placehold.co/600x200/png?text=Metric+Alert+Chart',
          alt_text: 'Metric Alert Chart',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Alert: <https://sentry.io/organizations/acme/monitors/alerts/1/|Checkout error rate>',
            },
          ],
        },
      ],
    },
  ],
};

export const threadReplyPayload: BlockKitPayload = {
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Jane Doe marked <https://sentry.io/organizations/acme/issues/1/?referrer=activity_notification&notification_uuid=example-uuid|JAVASCRIPT-1> as resolved',
      },
    },
  ],
};

export const issueAssignedPayload: BlockKitPayload = {
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'JAVASCRIPT-1 - ExampleError: something went wrong was assigned to Jane Doe by themselves',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '<https://sentry.io/organizations/acme/issues/1/|JAVASCRIPT-1> has been assigned to <mailto:jane@example.com|Jane Doe>',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '<https://sentry.io/organizations/acme/issues/1/|ExampleError: something went wrong> — `/api/v1/users/list/`',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "```Cannot read properties of null (reading 'example_property')```",
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Project: <https://sentry.io/organizations/acme/issues/?project=123|javascript>  ·  Alert: <https://sentry.io/organizations/acme/monitors/alerts/1/|Notify #feed-issues via Slack>  ·  <https://sentry.io/settings/account/notifications/alerts/|Manage Preferences>',
        },
      ],
    },
  ],
};

export const deployPayload: BlockKitPayload = {
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Deployed v1.0.0 of backend, frontend to production',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Release `v1.0.0` has been deployed to the production environment.',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Feb. 1, 2026, 6 a.m. UTC  ·  4 commits, 3 authors, and 12 files changed across 2 projects',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Projects:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'backend ( <https://sentry.io/organizations/acme/releases/v1.0.0/?project=1|View Release> ) resolving 2 issues.',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'frontend ( <https://sentry.io/organizations/acme/releases/v1.0.0/?project=2|View Release> ) resolving 4 issues.',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Repositories:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*getsentry/sentry*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'fix(auth): correct oauth redirect url  ·  _alice_  ·  _Jan. 1, 2026, 6 a.m. UTC_  ·  `a1b2c3d`',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'chore(platform): sort modules alphabetically  ·  _bob_  ·  _Jan. 2, 2026, 7 a.m. UTC_  ·  `a4b5c6d`',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*getsentry/getsentry*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "fix(platform): undo bob's sorting  ·  _alice_  ·  _Jan. 4, 2026, 9 a.m. UTC_  ·  `d1e2f30`",
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Alert: <https://sentry.io/organizations/acme/monitors/alerts/1/|Notify #feed-deploys via Slack>  ·  <https://sentry.io/settings/account/notifications/deploy/|Manage Preferences>',
        },
      ],
    },
  ],
};
