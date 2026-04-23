import {type ReactNode, useMemo} from 'react';
import type {LocationDescriptor} from 'history';

import {LinkButton} from '@sentry/scraps/button';

import {IconCompass} from 'sentry/icons/iconCompass';
import {IconFile} from 'sentry/icons/iconFile';
import {IconIssues} from 'sentry/icons/iconIssues';
import {IconPlay} from 'sentry/icons/iconPlay';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {IconSpan} from 'sentry/icons/iconSpan';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';
import {buildToolLinkUrl} from 'sentry/views/seerExplorer/utils';

interface AutofixEvidenceProps {
  toolCall: ToolCall;
  toolLink?: ToolLink;
}

export function AutofixEvidence({toolCall, toolLink}: AutofixEvidenceProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const target = useMemo(() => {
    if (!defined(toolLink)) {
      return null;
    }
    return buildToolLinkUrl(toolLink, organization.slug, projects);
  }, [organization, projects, toolLink]);

  if (defined(target)) {
    switch (toolCall.function) {
      case 'telemetry_live_search': {
        return (
          <EvidenceTelemetry target={target} toolCall={toolCall} toolLink={toolLink} />
        );
      }
      case 'get_trace_waterfall': {
        return <EvidenceTrace target={target} toolCall={toolCall} toolLink={toolLink} />;
      }
      case 'get_issue_details': {
        return <EvidenceIssue target={target} toolCall={toolCall} toolLink={toolLink} />;
      }
      case 'get_event_details': {
        return <EvidenceIssue target={target} toolCall={toolCall} toolLink={toolLink} />;
      }
      case 'get_replay_details': {
        return <EvidenceReplay target={target} toolCall={toolCall} toolLink={toolLink} />;
      }
      case 'get_profile_flamegraph': {
        return (
          <EvidenceProfile target={target} toolCall={toolCall} toolLink={toolLink} />
        );
      }
    }
  }

  // some tool calls do generate external links
  switch (toolCall.function) {
    case 'code_search': {
      return <EvidenceCodeSearch toolCall={toolCall} toolLink={toolLink} />;
    }
    default:
      return null;
  }
}

interface EvidenceLinkProps {
  target: LocationDescriptor;
  toolCall: ToolCall;
  toolLink?: ToolLink;
}

function EvidenceTelemetry({target, toolCall, toolLink}: EvidenceLinkProps) {
  const {args} = toolCall;
  const {question} = useMemo(() => {
    try {
      const parsedArgs = JSON.parse(args) || undefined;
      return {question: parsedArgs?.question};
    } catch {
      return {};
    }
  }, [args]);

  const {dataset} = toolLink?.params ?? {};
  const label = useMemo(() => {
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
  }, [dataset]);

  return (
    <EvidenceButton icon={<IconCompass />} to={target} tooltip={question}>
      {label}
    </EvidenceButton>
  );
}

function EvidenceTrace({target, toolLink}: EvidenceLinkProps) {
  const {trace_id, span_id} = toolLink?.params ?? {};

  if (typeof trace_id !== 'string') {
    return null;
  }

  if (defined(span_id) && typeof span_id !== 'string') {
    return null;
  }

  return (
    <EvidenceButton icon={<IconSpan />} to={target}>
      {defined(span_id)
        ? t('Span: %s', getShortEventId(span_id))
        : t('Trace: %s', getShortEventId(trace_id))}
    </EvidenceButton>
  );
}

function EvidenceIssue({target, toolLink}: EvidenceLinkProps) {
  const {event_id} = toolLink?.params ?? {};

  if (typeof event_id !== 'string') {
    return null; // This isn't useful evidence as we're already on the issue details page
  }

  return (
    <EvidenceButton icon={<IconIssues />} to={target}>
      {t('Error: %s', getShortEventId(event_id))}
    </EvidenceButton>
  );
}

function EvidenceReplay({target, toolLink}: EvidenceLinkProps) {
  const {replay_id} = toolLink?.params ?? {};

  if (typeof replay_id !== 'string') {
    return null;
  }

  return (
    <EvidenceButton icon={<IconPlay />} to={target}>
      {t('Replay: %s', getShortEventId(replay_id))}
    </EvidenceButton>
  );
}

function EvidenceProfile({target, toolLink}: EvidenceLinkProps) {
  const {profile_id} = toolLink?.params ?? {};

  if (typeof profile_id !== 'string') {
    return null;
  }

  return (
    <EvidenceButton icon={<IconProfiling />} to={target}>
      {t('Profile: %s', getShortEventId(profile_id))}
    </EvidenceButton>
  );
}

interface EvidenceCodeSearchProps {
  toolCall: ToolCall;
  toolLink?: ToolLink;
}

function EvidenceCodeSearch({toolCall, toolLink}: EvidenceCodeSearchProps) {
  const {args} = toolCall;
  const {mode, path} = useMemo(() => {
    try {
      const parsedArgs = JSON.parse(args) || undefined;
      return {mode: parsedArgs?.mode, path: parsedArgs?.path};
    } catch {
      return {};
    }
  }, [args]);

  switch (mode) {
    case 'read_file': {
      if (typeof path !== 'string') {
        return null;
      }
      const filename = path.split('/').pop();
      const {code_url} = toolLink?.params ?? {};

      if (!defined(filename) || !defined(code_url)) {
        return null;
      }

      return (
        <EvidenceButton icon={<IconFile />} href={code_url} tooltip={path}>
          {t('File: %s', truncateText(filename))}
        </EvidenceButton>
      );
    }
  }

  return null;
}

interface EvidenceButtonInternalProps {
  children: ReactNode;
  icon: ReactNode;
  to: LocationDescriptor;
  tooltip?: ReactNode;
}

interface EvidenceButtonExternalProps {
  children: ReactNode;
  href: string;
  icon: ReactNode;
  tooltip?: ReactNode;
}

function EvidenceButton({
  children,
  icon,
  tooltip,
  ...rest
}: EvidenceButtonInternalProps | EvidenceButtonExternalProps) {
  if ('to' in rest && defined(rest.to)) {
    return (
      <LinkButton
        icon={icon}
        size="zero"
        to={rest.to}
        tooltipProps={tooltip ? {title: tooltip} : undefined}
      >
        {children}
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
        {children}
      </LinkButton>
    );
  }

  return null;
}

function truncateText(text: string, maxLength = 16): string {
  const length = text.length;
  if (length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength / 2)}\u2026${text.substring(length - maxLength / 2, length)}`;
}
