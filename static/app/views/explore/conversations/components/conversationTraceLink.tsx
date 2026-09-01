import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {DropdownButton} from 'sentry/components/dropdownButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconChevron, IconSpan} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getExploreUrl} from 'sentry/views/explore/utils';

export interface ConversationTrace {
  /** A span within the trace, used to focus the trace view on the conversation. */
  spanId: string;
  traceId: string;
}

interface ConversationTraceLinkProps {
  conversationId: string;
  traces: ConversationTrace[];
}

/** Trace ids listed in the dropdown; the rest are reachable through "View all". */
const VISIBLE_TRACE_COUNT = 5;

/**
 * The traces a conversation spans. A single trace links straight to the trace
 * view; several open a dropdown of trace ids alongside a link to all of them.
 */
export function ConversationTraceLink({
  conversationId,
  traces,
}: ConversationTraceLinkProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const trackClick = () =>
    trackAnalytics('conversations.detail.click-trace-link', {organization});

  const [firstTrace] = traces;

  if (!firstTrace) {
    return null;
  }

  if (traces.length === 1) {
    return (
      <Link
        to={getTraceUrl(organization.slug, firstTrace.traceId, firstTrace.spanId)}
        onClick={trackClick}
      >
        <Flex align="center" gap="xs">
          <IconSpan size="xs" />
          <Text size="sm" variant="inherit" wrap="nowrap">
            {getShortTraceId(firstTrace.traceId)}
          </Text>
        </Flex>
      </Link>
    );
  }

  const viewAllUrl = getExploreUrl({
    organization,
    selection,
    query: `gen_ai.conversation.id:"${escapeDoubleQuotes(conversationId)}"`,
    table: 'trace',
  });

  const items: MenuItemProps[] = [
    ...traces.slice(0, VISIBLE_TRACE_COUNT).map(({traceId, spanId}) => ({
      key: traceId,
      label: getShortTraceId(traceId),
      // Accents the id and its icon, so each trace reads as a link.
      priority: 'primary' as const,
      leadingItems: <MenuTraceIcon size="xs" />,
      to: getTraceUrl(organization.slug, traceId, spanId),
      onAction: trackClick,
    })),
    {
      key: 'view-all',
      label: t('View all'),
      to: viewAllUrl,
      onAction: trackClick,
    },
  ];

  return (
    <DropdownMenu
      items={items}
      size="sm"
      trigger={(triggerProps, isOpen) => (
        <TraceTrigger
          {...triggerProps}
          isOpen={isOpen}
          size="zero"
          variant="transparent"
          showChevron={false}
        >
          <Flex align="center" gap="xs">
            <IconSpan size="xs" />
            <Text size="sm" variant="inherit" wrap="nowrap">
              {tn('%s trace', '%s traces', traces.length)}
            </Text>
            <IconChevron direction={isOpen ? 'down' : 'right'} size="xs" />
          </Flex>
        </TraceTrigger>
      )}
    />
  );
}

/** The menu pins leading items to the top, so centre the icon on the label. */
const MenuTraceIcon = styled(IconSpan)`
  align-self: center;
`;

const TraceTrigger = styled(DropdownButton)`
  color: ${p => p.theme.tokens.interactive.link.accent.rest};

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }
`;

function getShortTraceId(traceId: string) {
  return traceId.slice(0, 8);
}

function getTraceUrl(orgSlug: string, traceId: string, spanId: string) {
  return normalizeUrl(
    `/organizations/${orgSlug}/explore/traces/trace/${traceId}/?node=span-${spanId}`
  );
}
