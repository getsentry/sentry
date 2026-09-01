import {Fragment, type ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {IconCompass} from 'sentry/icons/iconCompass';
import {IconFile} from 'sentry/icons/iconFile';
import {IconIssues} from 'sentry/icons/iconIssues';
import {IconPlay} from 'sentry/icons/iconPlay';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {IconSpan} from 'sentry/icons/iconSpan';
import {IconTerminal} from 'sentry/icons/iconTerminal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {getShortEventId} from 'sentry/utils/events';
import {getShortCommitHash} from 'sentry/utils/git/getShortCommitHash';
import {useOrganization} from 'sentry/utils/useOrganization';
import {resolveLink, subjectFromToolLink} from 'sentry/views/seerExplorer/links';
import type {ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';

interface AutofixEvidenceProps {
  evidenceButtonProps: EvidenceButtonProps;
  groupId: string;
  toolCall: ToolCall;
}

export function AutofixEvidence({
  evidenceButtonProps,
  groupId,
  toolCall,
}: AutofixEvidenceProps) {
  const organization = useOrganization();
  const {prefix, suffix, label, icon, tooltip, ...rest} = evidenceButtonProps;

  const handleClick = () => {
    trackAnalytics('autofix.evidence.clicked', {
      organization,
      group_id: groupId,
      tool_name: toolCall.function,
    });
  };

  if ('to' in rest && defined(rest.to)) {
    return (
      <LinkButton
        icon={icon}
        size="zero"
        to={rest.to}
        openInNewTab
        onClick={handleClick}
        tooltipProps={tooltip ? {title: tooltip} : undefined}
      >
        {prefix}
        {': '}
        {truncateText(label)}
        {suffix}
      </LinkButton>
    );
  }

  if ('href' in rest && defined(rest.href)) {
    return (
      <LinkButton
        icon={icon}
        size="zero"
        href={rest.href}
        external
        onClick={handleClick}
        tooltipProps={tooltip ? {title: tooltip} : undefined}
      >
        {prefix}
        {': '}
        {truncateText(label)}
        {suffix}
      </LinkButton>
    );
  }

  // A tool that produced no navigable resource (e.g. a bash command) renders as a
  // plain chip rather than a link, so the reader still sees it happened.
  return (
    <Button
      disabled
      icon={icon}
      size="zero"
      tooltipProps={tooltip ? {title: tooltip} : undefined}
    >
      {prefix}
      {': '}
      {truncateText(label)}
      {suffix}
    </Button>
  );
}

interface EvidenceButtonInternalProps {
  icon: ReactNode;
  label: string;
  prefix: string;
  to: LocationDescriptor;
  suffix?: string;
  tooltip?: ReactNode;
}

interface EvidenceButtonExternalProps {
  href: string;
  icon: ReactNode;
  label: string;
  prefix: string;
  suffix?: string;
  tooltip?: ReactNode;
}

interface EvidenceButtonPlainProps {
  icon: ReactNode;
  label: string;
  prefix: string;
  suffix?: string;
  tooltip?: ReactNode;
}

export type EvidenceButtonProps =
  | EvidenceButtonInternalProps
  | EvidenceButtonExternalProps
  | EvidenceButtonPlainProps;

interface GetEvidencePropsPayload {
  organization: Organization;
  projects: Project[];
  toolCall: ToolCall;
  toolLink?: ToolLink;
}

function getTelemetryEvidenceProps({
  organization,
  projects,
  toolCall,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  if (!defined(toolLink)) {
    return null;
  }

  const target = resolveLink(subjectFromToolLink(toolLink), {
    organization,
    projects,
  })?.url;
  if (!defined(target)) {
    return null;
  }

  const {question} = parseArgs(toolCall);
  const {dataset} = toolLink.params ?? {};
  const label = getTelemetryEvidenceLabel(
    typeof dataset === 'string' ? dataset : undefined
  );

  return {
    to: target,
    icon: <IconCompass />,
    prefix: t('Query'),
    label,
    tooltip: question,
  };
}

function getTelemetryEvidenceLabel(dataset?: string) {
  switch (dataset) {
    case 'issues': {
      return t('Issues');
    }
    case 'errors':
      return t('Errors');
    case 'logs':
      return t('Logs');
    case 'metrics':
    case 'tracemetrics':
      return t('Metrics');
    case 'spans':
    default:
      return t('Spans');
  }
}

function getTraceWaterfallEvidenceProps({
  organization,
  projects,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  if (!defined(toolLink)) {
    return null;
  }

  const target = resolveLink(subjectFromToolLink(toolLink), {
    organization,
    projects,
  })?.url;
  if (!defined(target)) {
    return null;
  }

  const {trace_id, span_id} = toolLink.params ?? {};

  if (typeof trace_id !== 'string') {
    return null;
  }

  if (defined(span_id) && typeof span_id !== 'string') {
    return null;
  }

  const {prefix, label} = defined(span_id)
    ? {prefix: t('Span'), label: getShortEventId(span_id)}
    : {prefix: t('Trace'), label: getShortEventId(trace_id)};

  return {
    to: target,
    icon: <IconSpan />,
    prefix,
    label,
  };
}

function getIssueDetailsEvidenceProps({
  organization,
  projects,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  if (!defined(toolLink)) {
    return null;
  }

  const target = resolveLink(subjectFromToolLink(toolLink), {
    organization,
    projects,
  })?.url;
  if (!defined(target)) {
    return null;
  }

  const {event_id} = toolLink.params ?? {};

  if (typeof event_id !== 'string') {
    return null; // This isn't useful evidence as we're already on the issue details page
  }

  return {
    to: target,
    icon: <IconIssues />,
    prefix: t('Error'),
    label: getShortEventId(event_id),
  };
}

function getReplayDetailsEvidenceProps({
  organization,
  projects,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  if (!defined(toolLink)) {
    return null;
  }

  const target = resolveLink(subjectFromToolLink(toolLink), {
    organization,
    projects,
  })?.url;
  if (!defined(target)) {
    return null;
  }

  const {replay_id} = toolLink.params ?? {};

  if (typeof replay_id !== 'string') {
    return null;
  }

  return {
    to: target,
    icon: <IconPlay />,
    prefix: t('Replay'),
    label: getShortEventId(replay_id),
  };
}

function getProfileFlamegraphEvidenceProps({
  organization,
  projects,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  if (!defined(toolLink)) {
    return null;
  }

  const target = resolveLink(subjectFromToolLink(toolLink), {
    organization,
    projects,
  })?.url;
  if (!defined(target)) {
    return null;
  }

  const {profile_id} = toolLink.params ?? {};

  if (typeof profile_id !== 'string') {
    return null;
  }

  return {
    to: target,
    icon: <IconProfiling />,
    prefix: t('Profile'),
    label: getShortEventId(profile_id),
  };
}

function getCodeSearchEvidenceProps({
  toolCall,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  const {mode, path} = parseArgs(toolCall);

  if (mode === 'read_file') {
    if (typeof path !== 'string') {
      return null;
    }
    const {code_url, start_line, end_line} = toolLink?.params ?? {};
    return getFileEvidenceLink({
      codeUrl: code_url,
      filePath: path,
      startLine: start_line,
      endLine: end_line,
    });
  }

  return null;
}

function getGitSearchEvidenceProps({
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  const {
    repo_name,
    commit_url,
    sha,
    commits_url,
    start_date,
    end_date,
    file_path,
    provider,
  } = toolLink?.params ?? {};

  if (typeof commit_url === 'string' && typeof sha === 'string') {
    return {
      href: commit_url,
      icon: <RepoProviderIcon provider={provider ?? 'integrations:github'} />,
      prefix: t('Commit'),
      label: getShortCommitHash(sha),
      tooltip: sha,
    };
  }

  if (
    typeof commits_url === 'string' &&
    typeof repo_name === 'string' &&
    typeof start_date === 'string' &&
    typeof end_date === 'string'
  ) {
    const fileName =
      typeof file_path === 'string' ? extractFileName(file_path) : undefined;
    return {
      href: commits_url,
      icon: <RepoProviderIcon provider={provider ?? 'integrations:github'} />,
      prefix: t('Commits'),
      label: fileName ? fileName : repo_name,
      tooltip: (
        <Fragment>
          {typeof file_path === 'string' ? file_path : repo_name}
          <br />
          {start_date}
          {'\u2014'}
          {end_date}
        </Fragment>
      ),
    };
  }

  return null;
}

function getReadFileEvidenceProps({
  toolCall,
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  const {path} = parseArgs(toolCall);
  if (typeof path !== 'string') {
    return null;
  }
  const {code_url, start_line, end_line} = toolLink?.params ?? {};
  return getFileEvidenceLink({
    codeUrl: code_url,
    filePath: path,
    startLine: start_line,
    endLine: end_line,
  });
}

function getBashEvidenceProps({
  toolCall,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  // The bash tool emits no navigable resource — its tool link only carries a
  // description — so evidence is the command itself, rendered as a plain chip
  // with the full command in the tooltip.
  const {description, command} = parseArgs(toolCall);
  const descriptionText =
    typeof description === 'string' && description ? description : undefined;
  const commandText = typeof command === 'string' && command ? command : undefined;

  const label = descriptionText ?? commandText;
  if (!label) {
    return null;
  }

  return {
    icon: <IconTerminal />,
    prefix: t('Command'),
    label,
    tooltip: (
      <Stack>
        <Text>{label}</Text>
        {descriptionText && <Text>{commandText}</Text>}
      </Stack>
    ),
  };
}

/**
 * Build a "File: <name>" evidence link from a tool link's code URL.
 *
 * `codeUrl` is required; the displayed name is the basename of `filePath`.
 */
function getFileEvidenceLink({
  codeUrl,
  endLine,
  filePath,
  startLine,
}: {
  codeUrl: unknown;
  endLine?: unknown;
  filePath?: unknown;
  startLine?: unknown;
}): EvidenceButtonProps | null {
  if (typeof codeUrl !== 'string' || typeof filePath !== 'string') {
    return null;
  }

  const filename = extractFileName(filePath);
  if (!defined(filename)) {
    return null;
  }

  const lines =
    typeof startLine === 'number' && typeof endLine === 'number'
      ? startLine === endLine
        ? `L${startLine}`
        : `L${startLine}-L${endLine}`
      : undefined;

  return {
    href: lines ? `${codeUrl}#${lines}` : codeUrl,
    icon: <IconFile />,
    prefix: t('File'),
    label: filename,
    suffix: lines ? ` ${lines}` : undefined,
    tooltip: (
      <Fragment>
        {filePath}
        {lines && (
          <Fragment>
            <br />
            {lines}
          </Fragment>
        )}
      </Fragment>
    ),
  };
}

export const AUTOFIX_EVIDENCE_PROPS_RESOLVER: Record<
  string,
  (payload: GetEvidencePropsPayload) => EvidenceButtonProps | null
> = {
  telemetry_live_search: getTelemetryEvidenceProps,
  get_trace_waterfall: getTraceWaterfallEvidenceProps,
  get_issue_details: getIssueDetailsEvidenceProps,
  get_event_details: getIssueDetailsEvidenceProps,
  get_replay_details: getReplayDetailsEvidenceProps,
  get_profile_flamegraph: getProfileFlamegraphEvidenceProps,
  code_search: getCodeSearchEvidenceProps,
  git_search: getGitSearchEvidenceProps,
  read_file: getReadFileEvidenceProps,
  bash: getBashEvidenceProps,
};

function parseArgs(toolCall: ToolCall): any {
  try {
    const parsed = JSON.parse(toolCall.args);
    return defined(parsed) && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function extractFileName(filePath: string): string | undefined {
  return filePath.split('/').pop();
}

function truncateText(text: string, maxLength = 16): string {
  const length = text.length;
  if (length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength / 2)}\u2026${text.substring(length - maxLength / 2, length)}`;
}
