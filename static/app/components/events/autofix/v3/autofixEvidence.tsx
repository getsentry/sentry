import {type ReactNode, useMemo} from 'react';
import type {LocationDescriptor} from 'history';

import {LinkButton} from '@sentry/scraps/button';

import {IconCompass, IconIssues, IconPlay, IconProfiling, IconSpan} from 'sentry/icons';
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

  if (!defined(target)) {
    return null;
  }

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
      return <EvidenceProfile target={target} toolCall={toolCall} toolLink={toolLink} />;
    }
  }

  return null;
}

interface EvidenceLinkProps {
  target: LocationDescriptor;
  toolCall: ToolCall;
  toolLink?: ToolLink;
}

function EvidenceTelemetry({target, toolCall, toolLink}: EvidenceLinkProps) {
  const {args} = toolCall;
  const question = useMemo(() => {
    try {
      return JSON.parse(args).question || undefined;
    } catch {
      return undefined;
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

  return (
    <EvidenceButton icon={<IconSpan />} to={target}>
      {defined(span_id)
        ? t('Span: %s', getShortEventId(span_id))
        : t('Trace: %s', getShortEventId(trace_id))}
    </EvidenceButton>
  );
}

function EvidenceIssue({target, toolLink}: EvidenceLinkProps) {
  const {issue_id, event_id} = toolLink?.params ?? {};

  if (!defined(event_id)) {
    return null; // This isn't useful evidence as we're already on the issue details page
  }

  return (
    <EvidenceButton icon={<IconIssues />} to={target}>
      {t('Issue: %s', issue_id)}
    </EvidenceButton>
  );
}

function EvidenceReplay({target, toolLink}: EvidenceLinkProps) {
  const {replay_id} = toolLink?.params ?? {};
  return (
    <EvidenceButton icon={<IconPlay />} to={target}>
      {t('Replay: %s', getShortEventId(replay_id))}
    </EvidenceButton>
  );
}

function EvidenceProfile({target, toolLink}: EvidenceLinkProps) {
  const {profile_id} = toolLink?.params ?? {};
  return (
    <EvidenceButton icon={<IconProfiling />} to={target}>
      {t('Profile: %s', getShortEventId(profile_id))}
    </EvidenceButton>
  );
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
