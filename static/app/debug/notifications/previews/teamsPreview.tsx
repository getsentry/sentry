import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Disclosure} from '@sentry/scraps/disclosure';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
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
import {IconCheckmark, IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

const MSTEAMS_PREVIEW_URL = 'https://adaptivecards.microsoft.com/designer.html';

export function TeamsPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const {body, actions, subject, chart, footer} = registration.example;
  const previewTime = moment(new Date()).format('h:mm A');
  const card = registration.previews[NotificationProviderKey.TEAMS];

  const {copy} = useCopyToClipboard();

  return (
    <DebugNotificationsPreview
      title="MS Teams"
      actions={
        <ButtonBar>
          <Button
            size="xs"
            onClick={() =>
              copy(JSON.stringify(card, null, 2), {
                successMessage: t('Copied AdaptiveCard JSON to clipboard'),
                errorMessage: t('Failed to copy AdaptiveCard JSON to clipboard'),
              })
            }
            icon={<IconCopy />}
          >
            Copy JSON
          </Button>
          <LinkButton
            to={MSTEAMS_PREVIEW_URL}
            size="xs"
            icon={<PluginIcon pluginId="msteams" size={24} />}
            target="_blank"
          >
            Designer
          </LinkButton>
        </ButtonBar>
      }
    >
      <Container border="primary" radius="md">
        <TeamsPreviewContainer columns="auto 1fr" gap="0 lg" padding="xl">
          <SentryTeamsAppIcon />
          <TeamsMessage padding="xl" gap="md" direction="column">
            <Flex gap="md" align="center">
              <TeamsBlackText bold size="lg">
                Sentry
              </TeamsBlackText>
              <TeamsTimeText bold>{previewTime}</TeamsTimeText>
            </Flex>
            <TeamsCard direction="column" align="start" padding="xl" gap="md">
              <TeamsBlackText size="xl" bold>
                {subject}
              </TeamsBlackText>
              <TeamsBlackText>
                <NotificationBodyRenderer
                  body={body}
                  codeBlockBackground="#f3f2f1"
                  codeBlockBorder="#e1dfdd"
                />
              </TeamsBlackText>
              <Flex gap="md">
                {actions.map(action => (
                  <TeamsLinkButton key={action.label} href={action.link}>
                    {action.label}
                  </TeamsLinkButton>
                ))}
              </Flex>
              {chart && (
                <Flex direction="column" gap="xs">
                  <Image
                    height="116px"
                    width="auto"
                    src={chart.url}
                    alt={chart.alt_text}
                    objectFit="contain"
                  />
                </Flex>
              )}
              {footer && <TeamsBlackText size="sm">{footer}</TeamsBlackText>}
            </TeamsCard>
          </TeamsMessage>
        </TeamsPreviewContainer>
        <Disclosure>
          <Disclosure.Title>AdaptiveCard Payload</Disclosure.Title>
          <Disclosure.Content>
            <Flex direction="column" align="start" gap="xl">
              <Text>
                Below is the AdaptiveCard JSON payload that will be sent to MS Teams. For
                a dynamic preview, copy the JSON and paste it into the Designer linked
                above.
              </Text>
              <CodeBlock language="json">
                {card ? JSON.stringify(card, null, 2) : ''}
              </CodeBlock>
            </Flex>
          </Disclosure.Content>
        </Disclosure>
      </Container>
    </DebugNotificationsPreview>
  );
}
function SentryTeamsAppIcon() {
  return (
    <Container maxWidth="55px" position="relative" row="span 3">
      <SentryTeamsIcon fill="none" viewBox="0 0 34 36">
        <path
          fill="#fff"
          d="M18.7663 8.779a1.8625 1.8625 0 0 0-.6939-.6691 1.865 1.865 0 0 0-2.5332.7255l-2.5762 4.6441.6845.3768a13.027 13.027 0 0 1 4.6381 4.3466 13.0143 13.0143 0 0 1 2.0275 6.0221l-1.865.0326a11.1548 11.1548 0 0 0-1.7616-5.1003 11.1654 11.1654 0 0 0-3.9503-3.6785l-.6844-.3755-2.3998 4.343.6844.3768a6.2804 6.2804 0 0 1 2.0834 1.9011 6.2757 6.2757 0 0 1 1.0406 2.6204l-4.2599.0744a.3079.3079 0 0 1-.318-.3013.3073.3073 0 0 1 .0389-.1558l1.1514-2.0751a4.3185 4.3185 0 0 0-1.3688-.7496L7.5647 23.208a1.8612 1.8612 0 0 0 .727 2.5311c.286.1585.6089.2389.936.2332l5.8619-.1023-.0136-.776a7.7365 7.7365 0 0 0-.9122-3.514 7.743 7.743 0 0 0-2.4151-2.7122l.9043-1.6305a9.6094 9.6094 0 0 1 3.1019 3.383 9.6005 9.6005 0 0 1 1.1778 4.4345l.0136.7774 4.9674-.0868-.0136-.7759a14.5664 14.5664 0 0 0-1.8855-6.9042 14.5809 14.5809 0 0 0-4.9469-5.1753l1.8283-3.3007a.3073.3073 0 0 1 .2636-.1581.308.308 0 0 1 .269.1488l8.47 14.0856a.3066.3066 0 0 1 .0047.3099.307.307 0 0 1-.2677.1566l-1.9233.0336c.0335.5182.0452 1.0369.0272 1.5547l1.93-.0337a1.866 1.866 0 0 0 .9272-.2657 1.8624 1.8624 0 0 0 .9038-1.6284 1.862 1.862 0 0 0-.2655-.9266L18.7663 8.779Z"
        />
      </SentryTeamsIcon>
      <TeamsCheckmarkIcon size="sm" />
    </Container>
  );
}

const TeamsPreviewContainer = styled(Grid)`
  border: 1px solid #5c5fc7;
  border-radius: 4px 4px 0 0;
  background: #f4f2f0;
  cursor: default;
  color: black;
`;
const TeamsMessage = styled(Flex)`
  background: #ffffff;
  box-shadow: 0 2px 6px #ddd;
`;

const SentryTeamsIcon = styled('svg')`
  background: #5a4571;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  height: 40px;
  width: 50px;
`;

const TeamsCheckmarkIcon = styled(IconCheckmark)`
  background: #94ba5f;
  position: absolute;
  top: 30px;
  right: 4px;
  height: 14px;
  width: 14px;
  font-weight: bold;
  border-radius: 1000px;
  border: 2px solid white;
  color: ${p => p.theme.colors.white};
`;

const TeamsCard = styled(Flex)`
  border: 1px solid #e0e0e0;
  background: #fafafa;
`;

const TeamsBlackText = styled(Text)`
  color: black;
`;

const TeamsLinkButton = styled('a')`
  display: block;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: bold;
  border-radius: 4px;
  padding: ${p => `${p.theme.space.sm} ${p.theme.space.xl}`};
  border: 1px solid #aaa;
  color: black;
  background: white;
`;

const TeamsTimeText = styled(Text)`
  color: #5c5fc7;
`;
