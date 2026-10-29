import styled from '@emotion/styled';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {TimeSince} from 'sentry/components/timeSince';
import {UnreadIndicator} from 'sentry/components/unreadIndicator';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {InboxItem} from 'sentry/views/inbox/types';
import {InboxSubjectTypeIcon} from 'sentry/views/inbox/utils';

interface InboxItemListProps {
  items: InboxItem[];
  selectedItemId: string | null;
}

export function InboxItemList({items, selectedItemId}: InboxItemListProps) {
  return (
    <Stack as="ul" padding="0" margin="0">
      {items.map(item => (
        <InboxItemListItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedItemId}
        />
      ))}
    </Stack>
  );
}

interface InboxItemListItemProps {
  isSelected: boolean;
  item: InboxItem;
}

function InboxItemListItem({item, isSelected}: InboxItemListItemProps) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <Container as="li" borderBottom="primary">
      <ItemLink
        to={{
          pathname: normalizeUrl(`/organizations/${organization.slug}/inbox/${item.id}/`),
          query: location.query,
        }}
        aria-current={isSelected ? 'true' : undefined}
        data-selected={isSelected}
      >
        <InteractionStateLayer />
        <Grid columns="8px minmax(0, 1fr)" gap="xs md" align="center">
          <Flex>{item.isUnread && <UnreadIndicator />}</Flex>
          <Flex gap="md" align="center" justify="between">
            <Flex gap="sm" align="center" minWidth={0}>
              <InboxSubjectTypeIcon subjectType={item.subjectType} size="sm" />
              <Text bold ellipsis>
                {item.subject?.title ?? t('Unavailable')}
              </Text>
            </Flex>
            <Text size="sm" variant="muted" wrap="nowrap">
              <TimeSince
                date={item.lastActivityAt}
                unitStyle="extraShort"
                suffix=""
                disabledAbsoluteTooltip
              />
            </Text>
          </Flex>
          <Container column="2" minWidth={0}>
            <Text size="sm" variant="muted" ellipsis>
              {item.latestEvent.title}
            </Text>
          </Container>
        </Grid>
      </ItemLink>
    </Container>
  );
}

const ItemLink = styled(Link)`
  position: relative;
  display: block;
  padding: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }

  &[data-selected='true'] {
    background: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
  }
`;
