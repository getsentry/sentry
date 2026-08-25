import type {ComponentType, MouseEvent, ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {
  IconCode,
  IconCompass,
  IconDashboard,
  IconDocs,
  IconFire,
  IconIssues,
  IconList,
  IconPlay,
  IconProfiling,
  IconSiren,
  IconSpan,
  IconTable,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {isSafeHref} from 'sentry/utils/marked/marked';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * Every kind of thing Seer can point at, one icon and one short label each — the
 * "Base Data Points" and "Buckets" rows of the Telemetry Icons board. The mapping is
 * fixed per kind and lives here once so a trace looks like a trace everywhere it is
 * referenced: a Code Mode call's destination chip, a markdown embed, an autofix
 * evidence link.
 */
export type EvidenceType =
  | 'log'
  | 'trace'
  | 'profiling'
  | 'span'
  | 'error'
  | 'issue'
  | 'query'
  | 'metrics'
  | 'monitor'
  | 'replay'
  | 'docs'
  | 'code'
  | 'dashboard';

export const EVIDENCE_ICON: Record<EvidenceType, ComponentType<SVGIconProps>> = {
  log: IconList,
  trace: IconSpan,
  profiling: IconProfiling,
  span: IconSpan,
  error: IconFire,
  issue: IconIssues,
  query: IconCompass,
  metrics: IconTable,
  monitor: IconSiren,
  replay: IconPlay,
  docs: IconDocs,
  code: IconCode,
  dashboard: IconDashboard,
};

/**
 * The word shown before the value in the `button` variant (e.g. `Trace: a3805648`).
 * `code` has none — its value is already a path, not a bare id, so a prefix would
 * only repeat what the icon already says. Takes `t` rather than importing it: scraps
 * components read translations through `useTranslation()`, not `sentry/locale` directly.
 */
export function evidenceLabel(
  type: EvidenceType,
  t: (text: string) => string
): string | undefined {
  switch (type) {
    case 'log':
      return t('Log');
    case 'trace':
      return t('Trace');
    case 'profiling':
      return t('Profile');
    case 'span':
      return t('Span');
    case 'error':
      return t('Error');
    case 'issue':
      return t('Issue');
    case 'query':
      return t('Query');
    case 'metrics':
      return t('Metrics');
    case 'monitor':
      return t('Monitor');
    case 'replay':
      return t('Replay');
    case 'docs':
      return t('Docs');
    case 'dashboard':
      return t('Dashboard');
    case 'code':
      return undefined;
    default:
      return unreachable(type);
  }
}

interface EvidenceReferenceBaseProps {
  /** Which kind of thing `value` identifies — selects the icon and label prefix. */
  type: EvidenceType;
  /** The identifying value: a short id, a title, or (for `code`) a path. */
  value: string;
}

interface EvidenceReferenceButtonProps extends EvidenceReferenceBaseProps {
  /** A standalone chip, e.g. a `ToolCall` reference: icon, `Type: value`, one control. */
  variant: 'button';
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Omit for a non-interactive display chip. */
  to?: LocationDescriptor;
}

interface EvidenceReferenceLinkProps extends EvidenceReferenceBaseProps {
  href: string;
  /** An anchor inline with prose, e.g. a seer markdown embed: icon and value, no prefix. */
  variant: 'link';
}

export type EvidenceReferenceProps =
  | EvidenceReferenceButtonProps
  | EvidenceReferenceLinkProps;

function EvidenceButtonContent({type, value}: EvidenceReferenceBaseProps) {
  const {t} = useTranslation();
  const label = evidenceLabel(type, t);
  return label ? (
    <Text size="sm">
      {`${label}: `}
      <Text size="sm" bold>
        {value}
      </Text>
    </Text>
  ) : (
    <Text size="sm" bold>
      {value}
    </Text>
  );
}

function EvidenceReferenceButton({
  type,
  value,
  to,
  onClick,
}: EvidenceReferenceButtonProps) {
  const Icon = EVIDENCE_ICON[type];
  // No explicit size: `Button`/`LinkButton` already scale their `icon` via
  // `IconDefaultsProvider`, and a hardcoded size here would fight that when the chip's
  // button size ever changes.
  const icon = <Icon />;
  const content = <EvidenceButtonContent type={type} value={value} />;

  // A navigation target renders as a real anchor so middle/cmd-click and keyboard access work; an
  // `onClick`-only chip stays a button; a chip with neither is a non-interactive display chip.
  if (to) {
    return (
      <LinkButton size="xs" icon={icon} to={to} onClick={onClick}>
        {content}
      </LinkButton>
    );
  }

  return (
    <Button size="xs" icon={icon} onClick={onClick} disabled={!onClick}>
      {content}
    </Button>
  );
}

function EvidenceReferenceLink({
  type,
  value,
  href,
}: EvidenceReferenceLinkProps): ReactNode {
  const Icon = EVIDENCE_ICON[type];
  const icon = <Icon size="xs" style={{verticalAlign: 'middle'}} />;

  if (/^https?:\/\//.test(href) && isSafeHref(href)) {
    try {
      const parsed = new URL(href);
      if (parsed.origin !== window.location.origin) {
        return (
          <ExternalLink href={href}>
            {icon} {value}
          </ExternalLink>
        );
      }
      return (
        <Link to={parsed.pathname + parsed.search + parsed.hash}>
          {icon} {value}
        </Link>
      );
    } catch {
      return null;
    }
  }

  if (/^\/[^/]/.test(href)) {
    return (
      <Link to={href}>
        {icon} {value}
      </Link>
    );
  }

  return null;
}

/**
 * A reference to something Seer looked at — a trace, an issue, a search, a doc —
 * iconed and labeled the same way everywhere it shows up. `variant: 'button'` renders
 * a standalone chip (`Icon Type: value`); `variant: 'link'` renders an inline anchor
 * (`Icon value`) for prose contexts like a markdown embed.
 */
export function EvidenceReference(props: EvidenceReferenceProps): ReactNode {
  if (props.variant === 'button') {
    return <EvidenceReferenceButton {...props} />;
  }
  return <EvidenceReferenceLink {...props} />;
}
