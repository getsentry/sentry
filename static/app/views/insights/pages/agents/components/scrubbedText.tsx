import {Fragment} from 'react';

import {Link} from '@sentry/scraps/link';
import {annotate, splitAnnotations} from '@sentry/scraps/markdown';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Redaction} from 'sentry/components/events/meta/annotatedText/redaction';
import {getTooltipText} from 'sentry/components/events/meta/annotatedText/utils';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  TraceItemDetailsMeta,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';

/** Attributes rendered as AI content, which can show where their values were scrubbed. */
const MARKED_ATTRIBUTES = new Set([
  'gen_ai.input.messages',
  'gen_ai.output.messages',
  'gen_ai.request.messages',
  'gen_ai.response.object',
  'gen_ai.response.text',
  'gen_ai.system_instructions',
  'gen_ai.tool.call.arguments',
  'gen_ai.tool.call.result',
]);

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
  if (!meta?.[attribute] || !MARKED_ATTRIBUTES.has(attribute)) {
    return value;
  }
  const remarks = new TraceItemMetaInfo(meta)
    .getRemarks(attribute)
    .filter(
      ({rangeStart, rangeEnd}) =>
        Number.isInteger(rangeStart) && rangeStart < rangeEnd && rangeEnd <= value.length
    )
    .sort((a, b) => b.rangeStart - a.rangeStart);

  // From the end, so the earlier ranges' offsets still hold. Overlaps are skipped.
  let marked = value;
  let end = value.length;
  for (const {ruleId, type, rangeStart, rangeEnd} of remarks) {
    if (rangeEnd > end) {
      continue;
    }
    const rule: ScrubbingRule = {ruleId, remark: type, projectSlug};
    marked =
      marked.slice(0, rangeStart) +
      annotate(marked.slice(rangeStart, rangeEnd), JSON.stringify(rule)) +
      marked.slice(rangeEnd);
    end = rangeStart;
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

function isJson(value: string): boolean {
  if (!value.startsWith('{') && !value.startsWith('[')) {
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

export function renderScrubbedText(value: string) {
  return <ScrubbedText>{value}</ScrubbedText>;
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
    const rule = JSON.parse(data);
    return typeof rule?.ruleId === 'string' ? rule : undefined;
  } catch {
    return undefined;
  }
}

function ScrubbedTooltip({rule}: {rule: ScrubbingRule}) {
  const organization = useOrganization({allowNull: true}) ?? undefined;
  // Rules a customer adds are prefixed with their scope, like `project:0`. Built-in
  // rules, like `@email:replace`, come from the default scrubbing settings.
  const [scope, ruleName] = rule.ruleId.split(':');
  const isDefaultRule = rule.ruleId.startsWith('@');

  if (organization && scope === 'organization') {
    return tct(
      "Replaced because of a [rule:data scrubbing rule] in your organization's settings",
      {
        rule: (
          <Link
            to={`/settings/${organization.slug}/security-and-privacy/advanced-data-scrubbing/${ruleName}/`}
          />
        ),
      }
    );
  }

  if (organization && rule.projectSlug) {
    const settings = `/settings/${organization.slug}/projects/${rule.projectSlug}/security-and-privacy/`;
    if (scope === 'project') {
      return tct(
        'Replaced because of a [rule:data scrubbing rule] in the settings of the project [project]',
        {
          rule: <Link to={`${settings}advanced-data-scrubbing/${ruleName}/`} />,
          project: rule.projectSlug,
        }
      );
    }
    if (isDefaultRule) {
      return tct(
        'Replaced because of a default data scrubbing rule in the settings of the project [project]',
        {project: <Link to={settings}>{rule.projectSlug}</Link>}
      );
    }
  }

  if (isDefaultRule) {
    return t(
      "Replaced because of a default data scrubbing rule in your project's settings"
    );
  }
  // Size limits and the like, or rules whose settings can't be linked.
  return getTooltipText({remark: rule.remark, rule_id: rule.ruleId});
}
