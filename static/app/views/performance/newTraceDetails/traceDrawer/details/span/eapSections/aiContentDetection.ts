import {parseJsonWithFix} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type AIContentType =
  | 'json'
  | 'fixed-json'
  | 'python-dict'
  | 'markdown-with-xml'
  | 'markdown'
  | 'plain-text';

type ContentSegment =
  | {content: string; type: 'text'}
  | {content: string; tagName: string; type: 'xml-tag'};

interface AIContentDetectionResult {
  type: AIContentType;
  parsedData?: unknown;
  wasFixed?: boolean;
}

/** Best-effort conversion of a Python dict literal to a JSON-parseable string. */
export function tryParsePythonDict(text: string): Record<PropertyKey, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  if (!/'.+?'\s*:/.test(trimmed)) {
    return null;
  }

  try {
    let converted = trimmed;
    converted = converted.replace(/\bTrue\b/g, 'true');
    converted = converted.replace(/\bFalse\b/g, 'false');
    converted = converted.replace(/\bNone\b/g, 'null');
    converted = converted.replace(/'/g, '"');
    converted = converted.replace(/,\s*([}\]])/g, '$1');

    const parsed = JSON.parse(converted);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Splits text into segments of plain text and XML-like tag blocks. */
export function parseXmlTagSegments(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const xmlTagRegex = /<([a-zA-Z][\w-]*)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;

  for (const match of text.matchAll(xmlTagRegex)) {
    if (match.index > lastIndex) {
      segments.push({type: 'text', content: text.slice(lastIndex, match.index)});
    }
    segments.push({
      type: 'xml-tag',
      tagName: match[1]!,
      content: match[2]!,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({type: 'text', content: text.slice(lastIndex)});
  }

  return segments;
}

/** Replaces inline XML tags with italic markdown, leaves block-level tags untouched. */
export function preprocessInlineXmlTags(text: string): string {
  const xmlTagRegex = /<([a-zA-Z][\w-]*)>([\s\S]*?)<\/\1>/g;
  return text.replace(xmlTagRegex, (match, tagName, content, offset) => {
    const isBlock = offset === 0 || /\n\s*$/.test(text.slice(0, offset));
    if (isBlock) {
      return match;
    }
    const stripped = content.replace(/<\/?[a-zA-Z][\w-]*>/g, '').trim();
    return `*${tagName}: ${stripped}*`;
  });
}

const XML_TAG_REGEX = /<([a-zA-Z][\w-]*)>[\s\S]*?<\/\1>/;

const MARKDOWN_INDICATORS = [
  /^#{1,6}\s/m, // headings
  /\*\*.+?\*\*/, // bold
  /`.+?`/, // inline code
  /\[.+?\]\(.+?\)/, // links
  /^>\s/m, // blockquotes
  /^[-*]\s/m, // unordered lists
  /^\d+\.\s/m, // ordered lists
  /^```/m, // code fences
];

/** Detects AI content type: JSON, Python dict, markdown-with-xml, markdown, or plain text. */
export function detectAIContentType(text: string): AIContentDetectionResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {type: 'plain-text'};
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      return {type: 'json', parsedData: parsed};
    }
  } catch {
    // noop
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const pythonResult = tryParsePythonDict(trimmed);
    if (pythonResult) {
      return {type: 'python-dict', parsedData: pythonResult};
    }

    const {parsed, fixedInvalidJson} = parseJsonWithFix(trimmed);
    if (fixedInvalidJson && parsed !== null && typeof parsed === 'object') {
      return {type: 'fixed-json', parsedData: parsed, wasFixed: true};
    }
  }

  if (XML_TAG_REGEX.test(trimmed)) {
    return {type: 'markdown-with-xml'};
  }

  if (MARKDOWN_INDICATORS.some(re => re.test(trimmed))) {
    return {type: 'markdown'};
  }

  return {type: 'plain-text'};
}
