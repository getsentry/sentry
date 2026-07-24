import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {
  detectAIContentType,
  parseXmlTagSegments,
  preprocessInlineXmlTags,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';

interface AIContentRendererProps {
  text: string;
  autoCollapseLimit?: number;
  /**
   * Clips tall content behind a "Show More" button. Disable when the container
   * scrolls on its own. Only applies to non-inline content. When unset, text
   * defaults to clipped and JSON defaults to flowing (matching prior behavior).
   */
  clip?: boolean;
  collapsibleXmlTags?: boolean;
  inline?: boolean;
  maxJsonDepth?: number;
}

function XmlTagBlock({
  tagName,
  content,
  collapsible,
}: {
  content: string;
  tagName: string;
  collapsible?: boolean;
}) {
  const theme = useTheme();
  const label = (
    <Text size={collapsible ? 'md' : 'xs'} variant="muted">
      {tagName}
    </Text>
  );
  const body = (
    <MarkdownWithXmlRenderer text={content} collapsibleXmlTags={collapsible} />
  );

  if (collapsible) {
    return (
      <Container margin="sm 0">
        <CollapsibleContent title={label}>
          <Container paddingTop="md" paddingLeft="md">
            {body}
          </Container>
        </CollapsibleContent>
      </Container>
    );
  }

  return (
    <Stack
      padding="0 0 0 md"
      margin="sm 0"
      style={{borderLeft: `2px solid ${theme.tokens.border.primary}`}}
    >
      <Container margin="0 0 xs 0">{label}</Container>
      {body}
    </Stack>
  );
}

function MarkdownWithXmlRenderer({
  text,
  collapsibleXmlTags,
}: {
  text: string;
  collapsibleXmlTags?: boolean;
}) {
  const segments = useMemo(
    () => parseXmlTagSegments(preprocessInlineXmlTags(text)),
    [text]
  );

  return (
    <Fragment>
      {segments.map((segment, i) =>
        segment.type === 'xml-tag' ? (
          <XmlTagBlock
            key={i}
            tagName={segment.tagName}
            content={segment.content}
            collapsible={collapsibleXmlTags}
          />
        ) : (
          <MarkedText
            key={i}
            as={TraceDrawerComponents.MarkdownContainer}
            text={segment.content}
          />
        )
      )}
    </Fragment>
  );
}

/** Auto-detects AI content type and renders appropriately. */
export function AIContentRenderer({
  text,
  inline = false,
  maxJsonDepth = 2,
  autoCollapseLimit,
  collapsibleXmlTags = true,
  clip,
}: AIContentRendererProps) {
  const detection = useMemo(() => detectAIContentType(text), [text]);

  // Preserve each branch's historical default when the caller doesn't specify:
  // text was clipped, JSON flowed. Explicit `clip` always wins.
  const clipText = clip ?? true;
  const clipJson = clip ?? false;

  switch (detection.type) {
    case 'json':
    case 'fixed-json':
    case 'python-dict':
      return (
        <TraceDrawerComponents.MultilineJSON
          value={detection.parsedData}
          maxDefaultDepth={maxJsonDepth}
          autoCollapseLimit={autoCollapseLimit}
          clip={clipJson}
        />
      );

    case 'markdown-with-xml':
      if (inline) {
        return (
          <MarkdownWithXmlRenderer text={text} collapsibleXmlTags={collapsibleXmlTags} />
        );
      }
      return (
        <TraceDrawerComponents.MultilineText
          clip={clipText}
          renderFormatted={rawText => (
            <MarkdownWithXmlRenderer
              text={rawText}
              collapsibleXmlTags={collapsibleXmlTags}
            />
          )}
        >
          {text}
        </TraceDrawerComponents.MultilineText>
      );

    case 'markdown':
      if (inline) {
        return <MarkedText as={TraceDrawerComponents.MarkdownContainer} text={text} />;
      }
      return (
        <TraceDrawerComponents.MultilineText clip={clipText}>
          {text}
        </TraceDrawerComponents.MultilineText>
      );

    case 'plain-text':
    default:
      if (inline) {
        return <Fragment>{text}</Fragment>;
      }
      return (
        <TraceDrawerComponents.MultilineText clip={clipText}>
          {text}
        </TraceDrawerComponents.MultilineText>
      );
  }
}
