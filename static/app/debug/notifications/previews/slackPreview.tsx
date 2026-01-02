import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Disclosure} from '@sentry/scraps/disclosure';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CodeBlock} from 'sentry/components/core/code';
import {Image} from 'sentry/components/core/image/image';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {NotificationBodyRenderer} from 'sentry/debug/notifications/components/notificationBodyRenderer';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';

const SLACK_PREVIEW_BASE_URL = 'https://app.slack.com/block-kit-builder/';

export function SlackPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const {body, actions, subject, chart, footer} = registration.example;
  const previewTime = moment(new Date()).format('h:mm A');
  const blocks = registration.previews[NotificationProviderKey.SLACK];
  const previewLink = `${SLACK_PREVIEW_BASE_URL}#${JSON.stringify(blocks)}`;
  return (
    <DebugNotificationsPreview
      title="Slack"
      actions={
        <LinkButton
          to={previewLink}
          size="xs"
          icon={<PluginIcon pluginId="slack" size={24} />}
          target="_blank"
        >
          BlockKit Builder
        </LinkButton>
      }
    >
      <Container border="primary" radius="md">
        <SlackMessageContainer columns="auto 1fr" gap="0 lg" padding="xl">
          <SentrySlackAppIcon />
          <Flex gap="md" align="end">
            <SlackBlackText bold size="lg">
              Sentry
            </SlackBlackText>
            <SlackAppBadge bold>APP</SlackAppBadge>
            <SlackTimeText>{previewTime}</SlackTimeText>
          </Flex>
          <Flex direction="column" align="start" padding="sm 0" gap="md">
            <SlackBlackText size="xl" bold>
              {subject}
            </SlackBlackText>
            <SlackBodyText>
              <NotificationBodyRenderer
                body={body}
                codeBlockBackground="#f8f8f8"
                codeBlockBorder="#e0e0e0"
              />
            </SlackBodyText>
            <Flex gap="xs">
              {actions.map(action => (
                <SlackLinkButton key={action.label} href={action.link}>
                  {action.label}
                </SlackLinkButton>
              ))}
            </Flex>
            {chart && (
              <Flex direction="column" gap="xs">
                <Flex align="center" gap="xs">
                  <Text size="xs" variant="muted">
                    (17 kB)
                  </Text>
                  <SlackEmbedArrow>▾</SlackEmbedArrow>
                </Flex>
                <SlackChart
                  height="100px"
                  width="auto"
                  src={chart.url}
                  alt={chart.alt_text}
                  objectFit="contain"
                />
              </Flex>
            )}
            {footer && (
              <SlackBlackText size="xs" variant="muted">
                {footer}
              </SlackBlackText>
            )}
          </Flex>
        </SlackMessageContainer>
        <Disclosure>
          <Disclosure.Title>BlockKit Payload</Disclosure.Title>
          <Disclosure.Content>
            <Flex direction="column" align="start" gap="xl">
              <Text>
                Below is the BlockKit JSON payload that will be sent to Slack. For a
                dynamic preview, use the builder link above. The mock here is static, use
                this if you don't have a developer Slack account.
              </Text>
              <CodeBlock language="json">
                {blocks ? JSON.stringify(blocks, null, 2) : ''}
              </CodeBlock>
            </Flex>
          </Disclosure.Content>
        </Disclosure>
      </Container>
    </DebugNotificationsPreview>
  );
}

function SentrySlackAppIcon() {
  return (
    <SlackIconBackground fill="none" viewBox="0 0 34 36">
      <path
        fill="#fff"
        d="M18.7663 8.779a1.8625 1.8625 0 0 0-.6939-.6691 1.865 1.865 0 0 0-2.5332.7255l-2.5762 4.6441.6845.3768a13.027 13.027 0 0 1 4.6381 4.3466 13.0143 13.0143 0 0 1 2.0275 6.0221l-1.865.0326a11.1548 11.1548 0 0 0-1.7616-5.1003 11.1654 11.1654 0 0 0-3.9503-3.6785l-.6844-.3755-2.3998 4.343.6844.3768a6.2804 6.2804 0 0 1 2.0834 1.9011 6.2757 6.2757 0 0 1 1.0406 2.6204l-4.2599.0744a.3079.3079 0 0 1-.318-.3013.3073.3073 0 0 1 .0389-.1558l1.1514-2.0751a4.3185 4.3185 0 0 0-1.3688-.7496L7.5647 23.208a1.8612 1.8612 0 0 0 .727 2.5311c.286.1585.6089.2389.936.2332l5.8619-.1023-.0136-.776a7.7365 7.7365 0 0 0-.9122-3.514 7.743 7.743 0 0 0-2.4151-2.7122l.9043-1.6305a9.6094 9.6094 0 0 1 3.1019 3.383 9.6005 9.6005 0 0 1 1.1778 4.4345l.0136.7774 4.9674-.0868-.0136-.7759a14.5664 14.5664 0 0 0-1.8855-6.9042 14.5809 14.5809 0 0 0-4.9469-5.1753l1.8283-3.3007a.3073.3073 0 0 1 .2636-.1581.308.308 0 0 1 .269.1488l8.47 14.0856a.3066.3066 0 0 1 .0047.3099.307.307 0 0 1-.2677.1566l-1.9233.0336c.0335.5182.0452 1.0369.0272 1.5547l1.93-.0337a1.866 1.866 0 0 0 .9272-.2657 1.8624 1.8624 0 0 0 .9038-1.6284 1.862 1.862 0 0 0-.2655-.9266L18.7663 8.779Z"
      />
    </SlackIconBackground>
  );
}

const SlackMessageContainer = styled(Grid)`
  border: 1px solid;
  border-top-color: #35c5ef;
  border-right-color: #2eb67d;
  border-bottom-color: #ecb22e;
  border-left-color: #e01e5a;
  border-radius: 4px 4px 0 0;
  background: white;
  cursor: default;
  color: black;
`;

const SlackIconBackground = styled('svg')`
  background: #ff537f;
  border-radius: 6px;
  grid-row: span 3;
  height: 40px;
  width: 40px;
`;

const SlackAppBadge = styled(Text)`
  background-color: #f2f2f2;
  border-radius: 2px;
  padding: 0 4px;
  color: #454447;
`;

const SlackBlackText = styled(Text)`
  color: black;
  opacity: ${p => (p.variant === 'muted' ? 0.7 : 1)};
`;

const SlackBodyText = styled(SlackBlackText)`
  max-width: 540px;
`;

const SlackChart = styled(Image)`
  border-radius: 4px;
`;

const SlackLinkButton = styled('a')`
  display: block;
  font-size: 12px;
  font-weight: bold;
  border-radius: 6px;
  padding: ${p => `${p.theme.space.xs} ${p.theme.space.sm}`};
  border: 1px solid #aaa;
  color: black;
`;

const SlackTimeText = styled(Text)`
  color: #616061;
`;

const SlackEmbedArrow = styled('span')`
  color: #1364a3;
`;
