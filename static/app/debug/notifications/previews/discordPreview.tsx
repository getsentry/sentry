import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Disclosure} from '@sentry/scraps/disclosure';

import {CodeBlock} from 'sentry/components/core/code';
import {Image} from 'sentry/components/core/image';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {NotificationBodyRenderer} from 'sentry/debug/notifications/components/notificationBodyRenderer';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';

export function DiscordPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const {body, actions, subject, chart, footer} = registration.example;
  const previewTime = moment(new Date()).format('MM/DD/YY, h:mm A');
  const payload = registration.previews[NotificationProviderKey.DISCORD];
  return (
    <DebugNotificationsPreview title="Discord">
      <Container border="primary" radius="md">
        <DiscordMessageContainer columns="auto 1fr" gap="xs md" padding="xl">
          <SentryDiscordAppIcon />
          <Flex gap="md" align="end">
            <Flex gap="xs" align="center">
              <DiscordWhiteText bold size="lg">
                Sentry
              </DiscordWhiteText>
              <DiscordAppBadge bold size="sm">
                APP
              </DiscordAppBadge>
            </Flex>
            <DiscordTimeText size="sm">{previewTime}</DiscordTimeText>
          </Flex>
          <DiscordEmbedContainer
            direction="column"
            align="start"
            padding="lg xl"
            gap="md"
          >
            <DiscordWhiteText size="md" bold>
              {subject}
            </DiscordWhiteText>
            <DiscordWhiteText size="sm">
              <NotificationBodyRenderer
                body={body}
                codeBlockBackground="#2f3136"
                codeBlockBorder="#202225"
                codeBlockTextColor="#dcddde"
              />
            </DiscordWhiteText>
            {chart && (
              <DiscordChart
                height="100px"
                width="auto"
                src={chart.url}
                alt={chart.alt_text}
                objectFit="contain"
              />
            )}
            {footer && <DiscordWhiteText size="xs">{footer}</DiscordWhiteText>}
          </DiscordEmbedContainer>
          <Flex gap="xs">
            {actions.map(action => (
              <DiscordLinkButton key={action.label} href={action.link}>
                {action.label}
              </DiscordLinkButton>
            ))}
          </Flex>
        </DiscordMessageContainer>
        <Disclosure>
          <Disclosure.Title>Discord JSON Payload</Disclosure.Title>
          <Disclosure.Content>
            <Flex direction="column" gap="xl">
              <Text>
                Below is the JSON payload that will be sent to Discord. There is no online
                preview tool, so we're mocking it here, so use this as an approximation of
                what it'll look like on Discord.
              </Text>
              <CodeBlock language="json">
                {payload ? JSON.stringify(payload, null, 2) : ''}
              </CodeBlock>
            </Flex>
          </Disclosure.Content>
        </Disclosure>
      </Container>
    </DebugNotificationsPreview>
  );
}

function SentryDiscordAppIcon() {
  return (
    <DiscordIconGradient fill="none" viewBox="0 0 34 36">
      <path
        fill="#fff"
        d="M18.7663 8.779a1.8625 1.8625 0 0 0-.6939-.6691 1.865 1.865 0 0 0-2.5332.7255l-2.5762 4.6441.6845.3768a13.027 13.027 0 0 1 4.6381 4.3466 13.0143 13.0143 0 0 1 2.0275 6.0221l-1.865.0326a11.1548 11.1548 0 0 0-1.7616-5.1003 11.1654 11.1654 0 0 0-3.9503-3.6785l-.6844-.3755-2.3998 4.343.6844.3768a6.2804 6.2804 0 0 1 2.0834 1.9011 6.2757 6.2757 0 0 1 1.0406 2.6204l-4.2599.0744a.3079.3079 0 0 1-.318-.3013.3073.3073 0 0 1 .0389-.1558l1.1514-2.0751a4.3185 4.3185 0 0 0-1.3688-.7496L7.5647 23.208a1.8612 1.8612 0 0 0 .727 2.5311c.286.1585.6089.2389.936.2332l5.8619-.1023-.0136-.776a7.7365 7.7365 0 0 0-.9122-3.514 7.743 7.743 0 0 0-2.4151-2.7122l.9043-1.6305a9.6094 9.6094 0 0 1 3.1019 3.383 9.6005 9.6005 0 0 1 1.1778 4.4345l.0136.7774 4.9674-.0868-.0136-.7759a14.5664 14.5664 0 0 0-1.8855-6.9042 14.5809 14.5809 0 0 0-4.9469-5.1753l1.8283-3.3007a.3073.3073 0 0 1 .2636-.1581.308.308 0 0 1 .269.1488l8.47 14.0856a.3066.3066 0 0 1 .0047.3099.307.307 0 0 1-.2677.1566l-1.9233.0336c.0335.5182.0452 1.0369.0272 1.5547l1.93-.0337a1.866 1.866 0 0 0 .9272-.2657 1.8624 1.8624 0 0 0 .9038-1.6284 1.862 1.862 0 0 0-.2655-.9266L18.7663 8.779Z"
      />
    </DiscordIconGradient>
  );
}

const DiscordMessageContainer = styled(Grid)`
  border: 1px solid #5865f2;
  border-radius: 4px 4px 0 0;
  background: #1a1a1e;
  cursor: default;
`;

const DiscordWhiteText = styled(Text)`
  color: #fff !important;
`;

const DiscordIconGradient = styled('svg')`
  background: linear-gradient(to top right, #362c58 0%, #8d5394 100%);
  border-radius: 1000px;
  grid-row: span 3;
  height: 40px;
  width: 40px;
`;

const DiscordAppBadge = styled(Text)`
  background-color: #5865f2;
  border-radius: 4px;
  padding: 0 4px;
  color: #fff;
`;

const DiscordEmbedContainer = styled(Flex)`
  background: #242429;
  border-radius: 2px;
  border: 0.5px solid #3a3a40;
  border-left-width: 3px;
`;

const DiscordChart = styled(Image)`
  border-radius: 4px;
`;

const DiscordLinkButton = styled('a')`
  display: block;
  font-size: 12px;
  font-weight: bold;
  border-radius: 8px;
  padding: ${p => `${p.theme.space.sm} ${p.theme.space.md}`};
  background: #242429;
  color: #fff;
`;

const DiscordTimeText = styled(Text)`
  color: #81828a;
  font-weight: 500;
`;
