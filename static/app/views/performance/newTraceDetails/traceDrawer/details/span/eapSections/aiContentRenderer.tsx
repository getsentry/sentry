import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';
import {t} from 'sentry/locale';
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
    <Flex
      direction="column"
      padding="0 0 0 md"
      margin="sm 0"
      style={{borderLeft: `2px solid ${theme.tokens.border.primary}`}}
    >
      <Container margin="0 0 xs 0">{label}</Container>
      {body}
    </Flex>
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
  collapsibleXmlTags,
}: AIContentRendererProps) {
  const detection = useMemo(() => detectAIContentType(text), [text]);

  switch (detection.type) {
    case 'json':
    case 'python-dict':
      return (
        <TraceDrawerComponents.MultilineJSON
          value={detection.parsedData}
          maxDefaultDepth={maxJsonDepth}
          autoCollapseLimit={autoCollapseLimit}
        />
      );

    case 'fixed-json':
      return (
        <Fragment>
          <TraceDrawerComponents.MultilineJSON
            value={detection.parsedData}
            maxDefaultDepth={maxJsonDepth}
            autoCollapseLimit={autoCollapseLimit}
          />
          <Text size="xs" variant="muted">
            {t('Truncated')}
          </Text>
        </Fragment>
      );

    case 'markdown-with-xml':
      if (inline) {
        return (
          <MarkdownWithXmlRenderer text={text} collapsibleXmlTags={collapsibleXmlTags} />
        );
      }
      return (
        <TraceDrawerComponents.MultilineText
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
