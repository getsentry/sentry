import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {stripAnnotations} from '@sentry/scraps/markdown/annotation';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';

import {AiSpanStatusIcon} from './aiSpanStatusIcon';
import {ScrubbedText} from './scrubbedText';

/**
 * Building blocks shared by the one-line span rows of the Agent Timeline and the
 * conversation transcript: the span's icon, bold name and monospace preview, the
 * issue it raised, and the row's hover and selected states.
 */

interface AiSpanLabelProps {
  hasError: boolean;
  title: string;
  /** Leading icon variant, see `AiSpanStatusIcon`. */
  iconVariant?: 'inline' | 'plain';
  /** Leading icon, usually the span's own. Omitted when there's no span. */
  node?: AITraceSpanNode;
  /** One-line summary after the name, e.g. a tool call's arguments. */
  preview?: string | null;
}

/**
 * The span's icon, bold name and a monospace preview of its input, truncated as
 * one line. An errored span shows all of it in red.
 */
export function AiSpanLabel({
  node,
  title,
  preview,
  hasError,
  iconVariant = 'inline',
}: AiSpanLabelProps) {
  return (
    <Flex align="center" gap="sm" flex="1" minWidth={0}>
      {node ? <AiSpanStatusIcon node={node} variant={iconVariant} /> : null}
      <InfoText
        title={preview ? `${title} ${stripAnnotations(preview)}` : title}
        mode="overflowOnly"
        maxWidth={500}
        size="sm"
        variant="inherit"
      >
        <Text size="sm" bold variant={hasError ? 'danger' : 'primary'}>
          {title}
        </Text>
        {preview ? (
          <Fragment>
            {' '}
            <Text size="sm" monospace variant={hasError ? 'danger' : 'muted'}>
              {/* Tool input previews mark scrubbed values in the conversation view. */}
              <ScrubbedText>{preview}</ScrubbedText>
            </Text>
          </Fragment>
        ) : null}
      </InfoText>
    </Flex>
  );
}

/**
 * Links to the first issue the span raised: its project's avatar and the short
 * ID of the event. Sits above the row's select button, so it stays clickable.
 */
export function AiSpanIssueLink({node}: {node: AITraceSpanNode}) {
  const issue = node.uniqueIssues[0];
  return issue ? <IssueLink issue={issue} /> : null;
}

function IssueLink({issue}: {issue: TraceTree.TraceIssue}) {
  const organization = useOrganization();
  // Reads the loaded projects rather than fetching per row; the link works
  // without the avatar.
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === issue.project_slug);
  const shortEventId = getShortEventId(issue.event_id);

  return (
    <AboveRowButton>
      <Link
        to={normalizeUrl(
          `/organizations/${organization.slug}/issues/${issue.issue_id}/events/${issue.event_id}/`
        )}
        aria-label={t('View issue event %s', shortEventId)}
        onClick={e => e.stopPropagation()}
      >
        <Flex align="center" gap="xs">
          {project ? <ProjectAvatar project={project} size={14} /> : null}
          <Text size="sm" variant="accent" tabular>
            {shortEventId}
          </Text>
        </Flex>
      </Link>
    </AboveRowButton>
  );
}

/**
 * Lifts an interactive element, like an expand toggle or a link, above the
 * row's stretched select button so it receives its own clicks.
 */
export const AboveRowButton = styled(Flex)`
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  align-items: center;
`;

/**
 * Selects the row. Wraps the row's label, so the label names it, and stretches
 * over the whole row (which must be `position: relative`) so clicking anywhere
 * in it selects the span. Keeping it beside the issue link and metrics, rather
 * than around them, avoids nesting interactive elements.
 */
// eslint-disable-next-line @sentry/scraps/prefer-primitives -- Existing select button moved from aiSpanTimeline.tsx. Scraps Button centers and styles its content, and can't stretch over the row.
export const AiSpanRowButton = styled('button')`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  font: inherit;
  color: inherit;
  text-align: left;
  background-color: transparent;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  &:focus-visible {
    outline: none;
  }

  &:focus-visible::after {
    ${p => p.theme.focusRing()};
  }
`;

/**
 * Hover, active and selected states of a span row, keyed off `data-selected`.
 * The selected row gets an accent background and border.
 */
export function aiSpanRowStateCss(theme: Theme) {
  return css`
    position: relative;
    border: 1px solid transparent;
    border-radius: ${theme.radius.md};

    /* Hover/active feedback only applies while the row is not selected, so the
     * selected background is never masked. */
    &:not([data-selected='true']):hover {
      background-color: ${theme.tokens.interactive.transparent.neutral.background.hover};
    }

    &:not([data-selected='true']):active {
      background-color: ${theme.tokens.interactive.transparent.neutral.background.active};
    }

    &[data-selected='true'] {
      background-color: ${theme.tokens.background.transparent.accent.muted};
      border-color: ${theme.tokens.border.accent.moderate};
    }
  `;
}
