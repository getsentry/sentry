import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const enum EmailFormat {
  HTML = 'html',
  TXT = 'txt',
}

export function EmailPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const [emailFormat, setEmailFormat] = useLocalStorageState(
    'debug-notifications-email-format',
    EmailFormat.HTML
  );

  const {html_content, text_content, subject} =
    registration.previews[NotificationProviderKey.EMAIL];
  return (
    <DebugNotificationsPreview
      title="Email"
      actions={
        <SegmentedControl
          value={emailFormat}
          onChange={setEmailFormat}
          size="xs"
          aria-label="Change example data format"
        >
          <SegmentedControl.Item key={EmailFormat.HTML}>HTML</SegmentedControl.Item>
          <SegmentedControl.Item key={EmailFormat.TXT}>TXT</SegmentedControl.Item>
        </SegmentedControl>
      }
    >
      <Container border="primary" radius="md">
        <Flex direction="column" padding="xl">
          <Text bold>{subject}</Text>
          <Text variant="muted">To: user@example.com</Text>
          {emailFormat === EmailFormat.HTML && (
            <div dangerouslySetInnerHTML={{__html: html_content}} />
          )}
          {emailFormat === EmailFormat.TXT && (
            <EmailTextBlock>
              <pre>{text_content}</pre>
            </EmailTextBlock>
          )}
        </Flex>
      </Container>
    </DebugNotificationsPreview>
  );
}

const EmailTextBlock = styled('code')`
  margin: ${p => p.theme.space.md} 0;
  padding: 0;
  pre {
    margin: 0;
  }
`;
