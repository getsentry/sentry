import {Fragment, type ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {LinkButton} from '@sentry/scraps/button';

import {IconCompass} from 'sentry/icons/iconCompass';
import {IconFile} from 'sentry/icons/iconFile';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconIssues} from 'sentry/icons/iconIssues';
import {IconPlay} from 'sentry/icons/iconPlay';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {IconSpan} from 'sentry/icons/iconSpan';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {getShortCommitHash} from 'sentry/utils/git/getShortCommitHash';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';
import {buildToolLinkUrl} from 'sentry/views/seerExplorer/utils';

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
  const {label, icon, tooltip, ...rest} = evidenceButtonProps;

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
        {label}
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
        {label}
      </LinkButton>
    );
  }

  return null;
}

interface EvidenceButtonInternalProps {
  icon: ReactNode;
  label: ReactNode;
  to: LocationDescriptor;
  tooltip?: ReactNode;
}

interface EvidenceButtonExternalProps {
  href: string;
  icon: ReactNode;
  label: ReactNode;
  tooltip?: ReactNode;
}

export type EvidenceButtonProps =
  | EvidenceButtonInternalProps
  | EvidenceButtonExternalProps;

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

  const target = buildToolLinkUrl(toolLink, organization, projects);
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
    label,
    tooltip: question,
  };
}

function getTelemetryEvidenceLabel(dataset?: string) {
  switch (dataset) {
    case 'issues': {
      return t('Query: Issues');
    }
    case 'errors':
      return t('Query: Errors');
    case 'logs':
      return t('Query: Logs');
    case 'metrics':
    case 'tracemetrics':
      return t('Query: Metrics');
    case 'spans':
    default:
      return t('Query: Spans');
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

  const target = buildToolLinkUrl(toolLink, organization, projects);
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

  const label = defined(span_id)
    ? t('Span: %s', getShortEventId(span_id))
    : t('Trace: %s', getShortEventId(trace_id));

  return {
    to: target,
    icon: <IconSpan />,
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

  const target = buildToolLinkUrl(toolLink, organization, projects);
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
    label: t('Error: %s', getShortEventId(event_id)),
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

  const target = buildToolLinkUrl(toolLink, organization, projects);
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
    label: t('Replay: %s', getShortEventId(replay_id)),
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

  const target = buildToolLinkUrl(toolLink, organization, projects);
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
    label: t('Profile: %s', getShortEventId(profile_id)),
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
    const filename = extractFileName(path);
    const {code_url, start_line, end_line} = toolLink?.params ?? {};

    if (!defined(filename) || !defined(code_url)) {
      return null;
    }

    const hash =
      start_line && end_line
        ? start_line === end_line
          ? `L${start_line}`
          : `L${start_line}-L${end_line}`
        : undefined;

    return {
      href: hash ? `${code_url}#${hash}` : code_url,
      icon: <IconFile />,
      label: t('File: %s', truncateText(filename)),
      tooltip: path,
    };
  }

  return null;
}

function getGitSearchEvidenceProps({
  toolLink,
}: GetEvidencePropsPayload): EvidenceButtonProps | null {
  const {repo_name, commit_url, sha, commits_url, start_date, end_date, file_path} =
    toolLink?.params ?? {};

  if (typeof commit_url === 'string' && typeof sha === 'string') {
    return {
      href: commit_url,
      icon: <IconGithub />, // TODO: support other SCMs
      label: t('Commit: %s', truncateText(getShortCommitHash(sha))),
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
      icon: <IconGithub />, // TODO: support other SCMs
      label: t('Commits: %s', fileName ? truncateText(fileName) : repo_name),
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
