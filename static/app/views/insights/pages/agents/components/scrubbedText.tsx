import {Fragment} from 'react';

import {
  annotate,
  hasAnnotations,
  splitAnnotations,
  stripAnnotations,
} from '@sentry/scraps/markdown/annotation';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Redaction} from 'sentry/components/events/meta/annotatedText/redaction';
import {getTooltipText} from 'sentry/components/events/meta/annotatedText/utils';
import type {ChunkType} from 'sentry/types/group';
import {getAttributeSearchDeprecationAliases} from 'sentry/utils/fields/getAttributeSearchSecondaryAliases';
import {isRecord} from 'sentry/utils/object/isRecord';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  TraceItemDetailsMeta,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';

/**
 * Attributes that only annotation-aware components render, so their scrubbed ranges
 * can be marked. The endpoints return scrubbing meta for other string attributes
 * too, like `user.email`, but marking those would show the marks as stray
 * characters wherever they are rendered as plain text.
 *
 * Older spans hold these attributes under the names they had before, like
 * `gen_ai.tool.input`, which the conventions list.
 */
const ANNOTATION_AWARE_ATTRIBUTES = new Set(
  [
    'gen_ai.input.messages',
    'gen_ai.output.messages',
    'gen_ai.response.object',
    'gen_ai.system_instructions',
    'gen_ai.tool.call.arguments',
    'gen_ai.tool.call.result',
  ].flatMap(attribute => [attribute, ...getAttributeSearchDeprecationAliases(attribute)])
);

interface ScrubbingRule {
  remark: string;
  ruleId: string;
  projectSlug?: string;
}

/**
 * Wraps each range of an attribute's value that PII scrubbing changed in an
 * annotation naming the rule, so it stays marked once the value is parsed into
 * messages or JSON. The ranges point into the value as stored.
 */
export function markScrubbedValue(
  attribute: string,
  value: string,
  meta: TraceItemDetailsMeta | undefined,
  projectSlug: string | undefined
): string {
  if (!meta?.[attribute] || !ANNOTATION_AWARE_ATTRIBUTES.has(attribute)) {
    return value;
  }
  const remarks = new TraceItemMetaInfo(meta)
    .getRemarks(attribute)
    .flatMap(({ruleId, type, rangeStart, rangeEnd}) => {
      if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd)) {
        return [];
      }
      const start = utf8OffsetToIndex(value, rangeStart);
      const end = utf8OffsetToIndex(value, rangeEnd);
      return start !== undefined && end !== undefined && start < end
        ? [{ruleId, type, start, end}]
        : [];
    })
    .sort((a, b) => b.start - a.start);

  // From the end, so the earlier ranges' offsets still hold. Overlaps are skipped.
  let marked = value;
  let markedFrom = value.length;
  for (const {ruleId, type, start, end} of remarks) {
    if (end > markedFrom) {
      continue;
    }
    const rule: ScrubbingRule = {ruleId, remark: type, projectSlug};
    marked =
      marked.slice(0, start) +
      annotate(marked.slice(start, end), JSON.stringify(rule)) +
      marked.slice(end);
    markedFrom = start;
  }

  // A range across JSON syntax, rather than within a string, would break parsing.
  return isJson(value) && !isJson(marked) ? value : marked;
}

/** Marks the scrubbed ranges of a trace item's attributes, see `markScrubbedValue`. */
export function markScrubbedAttributes(
  attributes: TraceItemResponseAttribute[] | undefined,
  meta: TraceItemDetailsMeta | undefined,
  projectSlug: string | undefined
): TraceItemResponseAttribute[] | undefined {
  if (!attributes || !meta) {
    return attributes;
  }
  return attributes.map(attribute =>
    attribute.type === 'str'
      ? {
          ...attribute,
          value: markScrubbedValue(attribute.name, attribute.value, meta, projectSlug),
        }
      : attribute
  );
}

/**
 * Relay's remark ranges count the UTF-8 bytes of the value, while JavaScript
 * indexes strings by UTF-16 code units, so the two differ after any non-ASCII
 * character. Returns the index for `offset`, or undefined when it lies past the
 * end or inside a character.
 */
function utf8OffsetToIndex(value: string, offset: number): number | undefined {
  let bytes = 0;
  let index = 0;
  while (bytes < offset && index < value.length) {
    const codePoint = value.codePointAt(index) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
    index += codePoint > 0xffff ? 2 : 1;
  }
  return bytes === offset ? index : undefined;
}

function isJson(value: string): boolean {
  if (!/^\s*[{["]/.test(value)) {
    return false;
  }
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/** Renders text, marking the ranges from `markScrubbedValue`. */
export function ScrubbedText({children}: {children: string}) {
  return (
    <Fragment>
      {splitAnnotations(children).map((segment, index) =>
        typeof segment === 'string' ? (
          segment
        ) : (
          <ScrubbedAnnotation key={index} data={segment.data}>
            {segment.text}
          </ScrubbedAnnotation>
        )
      )}
    </Fragment>
  );
}

/** Renders a range from `markScrubbedValue` the way error events render redacted values. */
export function ScrubbedAnnotation({children, data}: {children: string; data: string}) {
  const rule = parseRule(data);
  if (!rule) {
    return <Fragment>{children}</Fragment>;
  }
  return (
    <Tooltip skipWrapper title={<ScrubbedTooltip rule={rule} />}>
      <Redaction>{children}</Redaction>
    </Tooltip>
  );
}

function parseRule(data: string): ScrubbingRule | undefined {
  try {
    const rule: unknown = JSON.parse(data);
    return isRecord(rule) &&
      typeof rule.ruleId === 'string' &&
      typeof rule.remark === 'string'
      ? {
          ruleId: rule.ruleId,
          remark: rule.remark,
          projectSlug:
            typeof rule.projectSlug === 'string' ? rule.projectSlug : undefined,
        }
      : undefined;
  } catch {
    return undefined;
  }
}

function ScrubbedTooltip({rule}: {rule: ScrubbingRule}) {
  const organization = useOrganization({allowNull: true}) ?? undefined;
  // The project's details hold its scrubbing rules, which the tooltip links to.
  // Only fetched once the tooltip opens.
  const {data: project} = useDetailedProject(
    {orgSlug: organization?.slug ?? '', projectSlug: rule.projectSlug ?? ''},
    {enabled: !!organization && !!rule.projectSlug, notifyOnChangeProps: ['data']}
  );
  return getTooltipText({
    remark: rule.remark,
    rule_id: rule.ruleId,
    organization,
    project,
    // A rule's description lists every attribute it applies to, which gets long
    // for rules that cover the AI attributes.
    hideRuleDescription: true,
  });
}

interface ScrubbedJson {
  /** Meta in the shape Relay reports for events, which `StructuredData` renders. */
  meta: Record<string, any> | undefined;
  /** The JSON without marks. */
  value: unknown;
}

/**
 * Splits parsed JSON whose strings carry marks from `markScrubbedValue` into the
 * plain JSON and the meta that makes `StructuredData` highlight the scrubbed
 * values. Meta describes values only, so marks in object keys are just removed.
 */
export function splitScrubbedJson(value: unknown): ScrubbedJson {
  if (typeof value === 'string') {
    return splitScrubbedString(value);
  }

  if (Array.isArray(value)) {
    const meta: Record<string, any> = {};
    const items = value.map((item, index) => {
      const split = splitScrubbedJson(item);
      if (split.meta) {
        meta[index] = split.meta;
      }
      return split.value;
    });
    return {value: items, meta: Object.keys(meta).length > 0 ? meta : undefined};
  }

  if (isRecord(value)) {
    const meta: Record<string, any> = {};
    const entries = Object.entries(value).map(([markedKey, item]) => {
      const key = stripAnnotations(markedKey);
      const split = splitScrubbedJson(item);
      if (split.meta) {
        meta[key] = split.meta;
      }
      return [key, split.value];
    });
    return {
      value: Object.fromEntries(entries),
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    };
  }

  return {value, meta: undefined};
}

function splitScrubbedString(value: string): ScrubbedJson {
  if (!hasAnnotations(value)) {
    return {value, meta: undefined};
  }
  const chunks = splitAnnotations(value).map((segment): ChunkType => {
    if (typeof segment === 'string') {
      return {type: 'text', text: segment, rule_id: ''};
    }
    const rule = parseRule(segment.data);
    return rule
      ? {type: 'redaction', text: segment.text, rule_id: rule.ruleId, remark: rule.remark}
      : {type: 'text', text: segment.text, rule_id: ''};
  });
  const rem = chunks
    .filter(chunk => chunk.type === 'redaction')
    .map(chunk => [chunk.rule_id, chunk.remark]);
  // A lone chunk gets the tooltip of a fully redacted event value, which looks the
  // rule up in the project of the page filters, not the span's. A second chunk
  // keeps every redaction on the per-chunk tooltip.
  if (chunks.length === 1) {
    chunks.push({type: 'text', text: '', rule_id: ''});
  }
  return {
    value: chunks.map(chunk => chunk.text).join(''),
    meta: rem.length > 0 ? {'': {rem, chunks}} : undefined,
  };
}
