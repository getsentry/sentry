import {useId} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {TimeSince} from 'sentry/components/timeSince';
import {UnreadIndicator} from 'sentry/components/unreadIndicator';
import {t} from 'sentry/locale';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {InboxItem} from 'sentry/views/inbox/types';
import {getInboxItemPath, INBOX_SUBJECT_CONFIG} from 'sentry/views/inbox/utils';

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
  const checkboxState = useListItemCheckboxContext();
  const checkboxId = useId();
  const SubjectIcon = INBOX_SUBJECT_CONFIG[item.subjectType].icon;
  const title = item.subject?.title ?? t('Unavailable');

  return (
    <Container position="relative" padding="xl" borderBottom="primary">
      {props => (
        <ItemRow {...props} data-selected={isSelected}>
          <InteractionStateLayer />
          <Grid columns="max-content 8px minmax(0, 1fr)" gap="xs md" align="center">
            <Container
              column="1 / 2"
              row="1 / span 2"
              alignSelf="stretch"
              position="relative"
            >
              {hitAreaProps => <CheckboxHitArea {...hitAreaProps} htmlFor={checkboxId} />}
            </Container>
            <Flex column="1" row="1">
              <ItemCheckbox
                id={checkboxId}
                aria-label={t('Select %s', title)}
                checked={checkboxState.isSelected(item.id) !== false}
                disabled={checkboxState.isSelected(item.id) === 'all-selected'}
                onChange={() => checkboxState.toggleSelected(item.id)}
              />
            </Flex>
            <Flex column="2" row="1">
              {item.isUnread && <UnreadIndicator />}
            </Flex>
            <Flex column="3" row="1" gap="md" align="center" justify="between">
              <Flex gap="sm" align="center" minWidth={0}>
                {linkProps => (
                  <ItemLink
                    {...linkProps}
                    to={{
                      pathname: getInboxItemPath(organization, item),
                      query: location.query,
                    }}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    <SubjectIcon size="sm" />
                    <Text bold ellipsis>
                      {title}
                    </Text>
                  </ItemLink>
                )}
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
            <Container column="3" row="2" minWidth={0}>
              <Text size="sm" variant="muted" ellipsis>
                {item.latestEvent.title}
              </Text>
            </Container>
          </Grid>
        </ItemRow>
      )}
    </Container>
  );
}

const ItemRow = styled('li')`
  list-style: none;

  &[data-selected='true'] {
    background: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
  }
`;

// Applies a larger hitbox area for the checkbox so it's easier to click.
// Should cover the entire left side of the list item.
const CheckboxHitArea = styled('label')`
  z-index: 1;
  max-width: none;
  margin-top: -${p => p.theme.space.xl};
  margin-right: -${p => p.theme.space.md};
  margin-bottom: -${p => p.theme.space.xl};
  margin-left: -${p => p.theme.space.xl};
  cursor: pointer;
`;

// Sits above the hit area so the checkbox keeps its own hover state
const ItemCheckbox = styled(Checkbox)`
  z-index: 1;
`;

// The link stretches over the whole row so that the entire row stays clickable
const ItemLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  &:focus-visible {
    box-shadow: none;
  }

  &:focus-visible::after {
    ${p => p.theme.focusRing()};
  }
`;
