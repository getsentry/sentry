import {type ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {LinkButton} from '@sentry/scraps/button';

import {IconCompass} from 'sentry/icons/iconCompass';
import {IconFile} from 'sentry/icons/iconFile';
import {IconIssues} from 'sentry/icons/iconIssues';
import {IconPlay} from 'sentry/icons/iconPlay';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {IconSpan} from 'sentry/icons/iconSpan';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import type {ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';
import {buildToolLinkUrl} from 'sentry/views/seerExplorer/utils';

interface AutofixEvidenceProps {
  evidenceButtonProps: EvidenceButtonProps;
}

export function AutofixEvidence({evidenceButtonProps}: AutofixEvidenceProps) {
  const {label, icon, tooltip, ...rest} = evidenceButtonProps;

  if ('to' in rest && defined(rest.to)) {
    return (
      <LinkButton
        icon={icon}
        size="zero"
        to={rest.to}
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

  const target = buildToolLinkUrl(toolLink, organization.slug, projects);
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

  const target = buildToolLinkUrl(toolLink, organization.slug, projects);
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

  const target = buildToolLinkUrl(toolLink, organization.slug, projects);
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

  const target = buildToolLinkUrl(toolLink, organization.slug, projects);
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

  const target = buildToolLinkUrl(toolLink, organization.slug, projects);
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
    const filename = path.split('/').pop();
    const {code_url} = toolLink?.params ?? {};

    if (!defined(filename) || !defined(code_url)) {
      return null;
    }

    return {
      href: code_url,
      icon: <IconFile />,
      label: t('File: %s', truncateText(filename)),
      tooltip: path,
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
};

function parseArgs(toolCall: ToolCall): any {
  try {
    const parsed = JSON.parse(toolCall.args);
    return defined(parsed) && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function truncateText(text: string, maxLength = 16): string {
  const length = text.length;
  if (length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength / 2)}\u2026${text.substring(length - maxLength / 2, length)}`;
}
