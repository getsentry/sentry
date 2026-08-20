import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import dompurify from 'dompurify';

import {Container, Stack} from '@sentry/scraps/layout';
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
        <Stack padding="xl">
          <Text bold>{subject}</Text>
          <Text variant="muted">To: user@example.com</Text>
          {emailFormat === EmailFormat.HTML && <EmailHtmlPreview html={html_content} />}
          {emailFormat === EmailFormat.TXT && (
            <EmailTextBlock>
              <pre>{text_content}</pre>
            </EmailTextBlock>
          )}
        </Stack>
      </Container>
    </DebugNotificationsPreview>
  );
}

/**
 * Emails are whole documents, so render one in an iframe rather than splicing
 * it into this page. Injecting it inline drops everything outside `<body>` and
 * lets the email's `<style>` and Sentry's own CSS bleed into each other, which
 * makes the preview unfaithful.
 *
 * `sandbox` without `allow-scripts` keeps the document inert; `allow-same-origin`
 * is only there so we can read `scrollHeight` to size the frame.
 */
function EmailHtmlPreview({html}: {html: string}) {
  const [height, setHeight] = useState(320);

  const sanitized = useMemo(
    () =>
      dompurify.sanitize(html, {
        WHOLE_DOCUMENT: true,
        ADD_TAGS: ['meta'],
        ADD_ATTR: ['name', 'content', 'charset'],
      }),
    [html]
  );

  const frameRef = useCallback(
    (node: HTMLIFrameElement | null) => {
      if (!node) {
        return;
      }
      // eslint-disable-next-line @sentry/no-trusted-types-sinks -- sanitized above; the rule cannot see through useMemo
      node.srcdoc = sanitized;
      node.onload = () => {
        const doc = node.contentDocument;
        if (doc) {
          setHeight(doc.documentElement.scrollHeight);
        }
      };
    },
    [sanitized]
  );

  return (
    <EmailFrame
      ref={frameRef}
      sandbox="allow-same-origin"
      title="Email preview"
      style={{height}}
    />
  );
}

const EmailFrame = styled('iframe')`
  width: 100%;
  border: 0;
`;

const EmailTextBlock = styled('code')`
  margin: ${p => p.theme.space.md} 0;
  padding: 0;
  pre {
    margin: 0;
  }
`;
