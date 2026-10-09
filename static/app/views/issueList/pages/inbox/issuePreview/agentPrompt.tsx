import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isRootCauseSection,
  isSolutionSection,
  type ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {EntryType, type Event, type Frame} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';

/** In-app frames carry the fix; runtime/vendor frames are noise in a prompt. */
const MAX_FRAMES = 12;

/**
 * Sections the agent can pull through the Sentry MCP. Keyed by the event entry
 * that supplies them, so the prompt only advertises what this event actually
 * has rather than a fixed wish list.
 */
const OMITTABLE_ENTRIES: Array<{label: string; type: EntryType}> = [
  {type: EntryType.BREADCRUMBS, label: 'breadcrumbs'},
  {type: EntryType.REQUEST, label: 'the HTTP request'},
  {type: EntryType.THREADS, label: 'other threads'},
];

function formatFrame(frame: Frame): string {
  const fn = frame.function || '<unknown>';
  const file = frame.filename || frame.module || '<unknown>';
  const line = frame.lineNo === null ? '' : `:${frame.lineNo}`;
  const suspectLine = frame.context?.find(([lineNo]) => lineNo === frame.lineNo)?.[1];
  return suspectLine
    ? `  ${fn} (${file}${line})\n    ${suspectLine.trim()}`
    : `  ${fn} (${file}${line})`;
}

/**
 * The exception that actually threw is the LAST one: earlier entries are the
 * wrappers that caught and rethrew it (React error boundaries, middleware).
 * Tail-trimming a rendered payload keeps those wrappers and drops this one.
 */
function formatCulpritException(event: Event | undefined): string {
  const entry = event?.entries?.find(e => e.type === EntryType.EXCEPTION);
  if (entry?.type !== EntryType.EXCEPTION) {
    return '';
  }
  const values = entry.data.values ?? [];
  const culprit = values.at(-1);
  if (!culprit) {
    return '';
  }

  const lines: string[] = ['## Exception', ''];
  if (culprit.type) {
    lines.push(`**Type:** ${culprit.type}`);
  }
  if (culprit.value) {
    lines.push(`**Value:** ${culprit.value}`);
  }
  if (values.length > 1) {
    lines.push(
      `\n_${values.length - 1} wrapping exception(s) omitted; this is the one that threw._`
    );
  }

  const allFrames = culprit.stacktrace?.frames ?? [];
  // Prefer in-app frames, but fall back to everything for vendored-only traces.
  const inAppFrames = allFrames.filter(frame => frame.inApp);
  const frames = (inAppFrames.length > 0 ? inAppFrames : allFrames).slice(-MAX_FRAMES);

  if (frames.length > 0) {
    lines.push(
      '',
      `### Stacktrace (${inAppFrames.length > 0 ? 'in-app frames' : 'all frames'}, most recent last)`,
      '',
      '```',
      ...frames.map(formatFrame),
      '```'
    );
  }

  return lines.join('\n');
}

function formatSeerAnalysis(autofixData: ExplorerAutofixState | null): string {
  const sections = getOrderedAutofixSections(autofixData);
  const artifacts = [
    sections.find(isRootCauseSection),
    sections.find(isSolutionSection),
  ].map(section => (section ? getAutofixArtifactFromSection(section) : null));

  return artifacts
    .map(artifact => (artifact ? artifactToMarkdown(artifact, 2) : null))
    .filter(Boolean)
    .join('\n\n');
}

function describeOmissions(event: Event | undefined): string[] {
  const present = new Set<string>(event?.entries?.map(entry => entry.type));
  const omitted = OMITTABLE_ENTRIES.filter(({type}) => present.has(type)).map(
    ({label}) => label
  );

  if (event?.tags?.length) {
    omitted.push('the full tag set');
  }
  omitted.push('the complete stacktrace for every exception');
  return omitted;
}

/**
 * Builds the prompt handed to a coding agent, which is deliberately NOT the
 * same payload as "Copy as Markdown".
 *
 * The clipboard has no size limit, so copying sends the whole issue. Deeplinks
 * cap out between 5,000 and 14,000 characters while a full issue runs to
 * ~20,000, so a tail-trim keeps whatever happens to come first. On a React
 * error that means the ErrorBoundary wrapper frames survive and the exception
 * that actually threw is cut — which reads as complete while omitting the
 * answer.
 *
 * So this selects rather than trims: Seer's analysis (highest value, and
 * small), the in-app frames of the exception that threw, and a permalink so
 * the agent can pull the rest through the Sentry MCP.
 */
export function buildAgentPrompt({
  autofixData,
  event,
  group,
}: {
  group: Group;
  autofixData?: ExplorerAutofixState | null;
  event?: Event;
}): string {
  const blocks: string[] = [
    'Triage this issue from Sentry.',
    '',
    `**Issue:** ${group.title}`,
  ];

  if (group.shortId) {
    blocks.push(`**Short ID:** ${group.shortId}`);
  }
  if (group.project?.slug) {
    blocks.push(`**Project:** ${group.project.slug}`);
  }
  if (group.culprit) {
    blocks.push(`**Culprit:** ${group.culprit}`);
  }
  if (group.permalink) {
    blocks.push(`**Permalink:** ${group.permalink}`);
  }

  const seer = formatSeerAnalysis(autofixData ?? null);
  if (seer) {
    blocks.push('', seer);
  }

  const exception = formatCulpritException(event);
  if (exception) {
    blocks.push('', exception);
  }

  const omissions = describeOmissions(event);
  if (group.permalink) {
    blocks.push(
      '',
      '---',
      '',
      'This prompt is an extract, trimmed to fit a deeplink. Fetch the issue with',
      `the Sentry MCP to get the details left out — ${omissions.join(', ')}:`,
      '',
      group.permalink,
      '',
      'Then confirm the root cause against the real code before changing anything.'
    );
  }

  return blocks.join('\n');
}
