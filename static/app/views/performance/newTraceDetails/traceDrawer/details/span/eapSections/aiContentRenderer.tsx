import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';
import {StructuredData} from 'sentry/components/structuredEventData';
import {getDefaultExpanded} from 'sentry/components/structuredEventData/utils';
import {
  detectAIContentType,
  parseXmlTagSegments,
  preprocessInlineXmlTags,
  tryParsePythonDict,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';
import {fenceContent} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentFencing';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {parseJsonWithFix} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

// Sensible defaults for JSON embedded in a larger message, distinct from a
// whole-message JSON payload (which threads its own depth/collapse settings).
const EMBEDDED_JSON_MAX_DEPTH = 2;
const EMBEDDED_JSON_AUTO_COLLAPSE_LIMIT = 5;

const STRUCTURED_DATA_CONFIG = {
  isString: (v: unknown) => typeof v === 'string',
  isBoolean: (v: unknown) => typeof v === 'boolean',
  isNumber: (v: unknown) => typeof v === 'number',
};

/**
 * Parses JSON leniently — strict JSON, then repaired JSON, then a Python-repr
 * dict (single quotes, True/False/None). Returns null if none apply.
 */
function parseJson(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // fall through to the lenient parsers
  }
  const {parsed, fixedInvalidJson} = parseJsonWithFix(raw);
  if (fixedInvalidJson && typeof parsed === 'object' && parsed !== null) {
    return parsed;
  }
  return tryParsePythonDict(raw);
}

/** Renders a parsed JSON value as an interactive tree, without any surrounding chrome. */
function JsonTree({value}: {value: unknown}) {
  const initialExpandedPaths = Array.from(
    new Set([
      '$',
      ...getDefaultExpanded(
        EMBEDDED_JSON_MAX_DEPTH,
        value,
        EMBEDDED_JSON_AUTO_COLLAPSE_LIMIT
      ),
    ])
  );
  return (
    <StructuredData
      config={STRUCTURED_DATA_CONFIG}
      value={value}
      maxDefaultDepth={EMBEDDED_JSON_MAX_DEPTH}
      autoCollapseLimit={EMBEDDED_JSON_AUTO_COLLAPSE_LIMIT}
      initialExpandedPaths={initialExpandedPaths}
      withAnnotatedText
    />
  );
}

// Renders ```json code blocks as an interactive JSON tree, falling back to a
// highlighted code block when the content isn't valid JSON. Only fenced code
// blocks are handled; inline `code` spans are left untouched. Unknown {% tag %}
// tokens fall through to default Markdown, which echoes their original source.
const markdownComponents: MarkdownProps['components'] = {
  CodeBlock: ({children, lang, Default}) => {
    if (lang?.toLowerCase() === 'json') {
      const parsed = parseJson(children);
      if (parsed !== null) {
        return <JsonTree value={parsed} />;
      }
    }
    return <Default lang={lang}>{children}</Default>;
  },
};

/** Fences raw AI content and renders it. Memoized since fencing scans the whole string. */
function FencedMarkdown({raw}: {raw: string}) {
  const fenced = useMemo(() => fenceContent(raw), [raw]);
  return <Markdown raw={fenced} components={markdownComponents} />;
}

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

/**
 * Tag names (case-insensitive, punctuation-insensitive) whose collapsible
 * blocks start expanded — the user's own message is the most useful content in
 * a transcript, so we don't hide it behind a caret.
 */
const EXPANDED_BY_DEFAULT_TAGS = new Set(['usermessage', 'usermsg', 'userinput']);

function isExpandedByDefaultTag(tagName: string): boolean {
  return EXPANDED_BY_DEFAULT_TAGS.has(tagName.toLowerCase().replace(/[-_]/g, ''));
}

function XmlTagBlock({
  tagName,
  attributes,
  content,
  collapsible,
}: {
  attributes: string;
  content: string;
  tagName: string;
  collapsible?: boolean;
}) {
  const theme = useTheme();
  // Show the tag as it appears in the raw text (name + attributes), kept to a
  // single line with an ellipsis and a tooltip when it overflows.
  const rawTag = `<${tagName}${attributes}>`;
  const label = (
    <Flex flex="1" minWidth={0}>
      {/* Not InfoText: it repurposes `variant` for the tooltip underline, so it
          can't render the label in the muted text color used here. */}
      {/* eslint-disable-next-line @sentry/scraps/prefer-info-text */}
      <Tooltip title={rawTag} showOnlyOnOverflow skipWrapper>
        <Text size={collapsible ? 'md' : 'xs'} variant="muted" ellipsis>
          {rawTag}
        </Text>
      </Tooltip>
    </Flex>
  );
  const body = (
    <MarkdownWithXmlRenderer text={content} collapsibleXmlTags={collapsible} />
  );

  if (collapsible) {
    return (
      <Container margin="sm 0">
        <CollapsibleContent title={label} defaultOpen={isExpandedByDefaultTag(tagName)}>
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
            attributes={segment.attributes}
            content={segment.content}
            collapsible={collapsibleXmlTags}
          />
        ) : (
          <FencedMarkdown key={i} raw={segment.content} />
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
        return <FencedMarkdown raw={text} />;
      }
      return (
        <TraceDrawerComponents.MultilineText
          clip={clipText}
          renderFormatted={rawText => <FencedMarkdown raw={rawText} />}
        >
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
