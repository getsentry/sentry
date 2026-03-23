import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {
  detectAIContentType,
  parseXmlTagSegments,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';

interface AIContentRendererProps {
  text: string;
  /** When true, renders content directly without a wrapper or raw/pretty toggle. */
  inline?: boolean;
  maxJsonDepth?: number;
}

function XmlTagBlock({tagName, content}: {content: string; tagName: string}) {
  const theme = useTheme();

  return (
    <Flex
      direction="column"
      padding="0 0 0 md"
      margin="sm 0"
      style={{borderLeft: `3px solid ${theme.tokens.border.accent.moderate}`}}
    >
      <Container margin="0 0 xs 0">
        <Text size="xs" variant="muted">
          {tagName}
        </Text>
      </Container>
      <Text italic>
        <MarkedText as={TraceDrawerComponents.MarkdownContainer} text={content} />
      </Text>
    </Flex>
  );
}

function MarkdownWithXmlRenderer({text}: {text: string}) {
  const segments = useMemo(() => parseXmlTagSegments(text), [text]);

  return (
    <Fragment>
      {segments.map((segment, i) =>
        segment.type === 'xml-tag' ? (
          <XmlTagBlock key={i} tagName={segment.tagName} content={segment.content} />
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

/**
 * Unified AI content renderer that auto-detects content type and renders appropriately.
 * Handles JSON, Python dicts, partial JSON, markdown with XML tags, markdown, and plain text.
 */
export function AIContentRenderer({
  text,
  inline = false,
  maxJsonDepth = 2,
}: AIContentRendererProps) {
  const detection = useMemo(() => detectAIContentType(text), [text]);

  switch (detection.type) {
    case 'json':
    case 'python-dict':
      return (
        <TraceDrawerComponents.MultilineJSON
          value={detection.parsedData}
          maxDefaultDepth={maxJsonDepth}
        />
      );

    case 'fixed-json':
      return (
        <Fragment>
          <TraceDrawerComponents.MultilineJSON
            value={detection.parsedData}
            maxDefaultDepth={maxJsonDepth}
          />
          <Text size="xs" variant="muted">
            {t('Truncated')}
          </Text>
        </Fragment>
      );

    case 'markdown-with-xml':
      if (inline) {
        return <MarkdownWithXmlRenderer text={text} />;
      }
      return (
        <TraceDrawerComponents.MultilineText
          renderFormatted={rawText => <MarkdownWithXmlRenderer text={rawText} />}
        >
          {text}
        </TraceDrawerComponents.MultilineText>
      );

    case 'markdown':
      if (inline) {
        return <MarkedText as={TraceDrawerComponents.MarkdownContainer} text={text} />;
      }
      return (
        <TraceDrawerComponents.MultilineText>{text}</TraceDrawerComponents.MultilineText>
      );

    case 'plain-text':
    default:
      if (inline) {
        return <Fragment>{text}</Fragment>;
      }
      return (
        <TraceDrawerComponents.MultilineText>{text}</TraceDrawerComponents.MultilineText>
      );
  }
}
