import {useCallback, useMemo} from 'react';
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

// Emails are whole HTML documents — isolate in an iframe so their CSS and the
// app's don't bleed both ways. sandbox omits allow-scripts (inert doc);
// allow-same-origin is only so we can read scrollHeight to size the frame.
function EmailHtmlPreview({html}: {html: string}) {
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

      let observer: ResizeObserver | undefined;
      let disposed = false;

      const handleLoad = () => {
        observer?.disconnect();
        observer = undefined;

        if (disposed) {
          return;
        }

        const doc = node.contentDocument;
        if (!doc?.body) {
          return;
        }

        // Collapse before measuring: scrollHeight can't fall below the frame's own
        // height, so a shorter email couldn't shrink it otherwise. Re-measure when
        // late images or fonts reflow the document.
        const measure = () => {
          node.style.height = '0';
          node.style.height = `${doc.documentElement.scrollHeight}px`;
        };

        measure();
        observer = new ResizeObserver(measure);
        observer.observe(doc.body);
      };

      node.addEventListener('load', handleLoad);
      node.srcdoc = sanitized;

      return () => {
        disposed = true;
        node.removeEventListener('load', handleLoad);
        observer?.disconnect();
      };
    },
    [sanitized]
  );

  return <EmailFrame ref={frameRef} sandbox="allow-same-origin" title="Email preview" />;
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
