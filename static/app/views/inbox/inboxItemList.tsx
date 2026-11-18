import {useId} from 'react';
import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconDelete} from '@sentry/icons/delete';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconMail} from '@sentry/icons/mail';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Checkbox} from '@sentry/scraps/checkbox';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {TimeSince} from 'sentry/components/timeSince';
import {UnreadIndicator} from 'sentry/components/unreadIndicator';
import {t} from 'sentry/locale';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  removeInboxItemsMutationOptions,
  updateInboxItemsMutationOptions,
} from './inboxApiOptions';
import type {InboxFilters, InboxItem} from './types';
import {getInboxItemPath, INBOX_SUBJECT_CONFIG} from './utils';

interface InboxItemListProps {
  filters: InboxFilters;
  items: InboxItem[];
  selectedItemId: string | null;
}

export function InboxItemList({items, selectedItemId, filters}: InboxItemListProps) {
  return (
    <Stack as="ul" padding="0" margin="0">
      {items.map(item => (
        <InboxItemListItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedItemId}
          filters={filters}
        />
      ))}
    </Stack>
  );
}

interface InboxItemListItemProps {
  filters: InboxFilters;
  isSelected: boolean;
  item: InboxItem;
}

function InboxItemListItem({item, isSelected, filters}: InboxItemListItemProps) {
  const organization = useOrganization();
  const checkboxState = useListItemCheckboxContext();
  const checkboxId = useId();
  const SubjectIcon = INBOX_SUBJECT_CONFIG[item.subjectType].icon;
  const title = item.title ?? t('Unavailable');
  const queryClient = useQueryClient();
  const {mutate: updateInboxItems, isPending: isUpdating} = useMutation(
    updateInboxItemsMutationOptions({organization, queryClient})
  );
  const {mutate: removeInboxItems, isPending: isRemoving} = useMutation({
    ...removeInboxItemsMutationOptions({organization, queryClient}),
    onSuccess: (_data, {ids}) =>
      toast.success(t('Removed 1 item'), {
        action: {
          label: t('Undo'),
          onClick: () => updateInboxItems({selection: ids, update: {undoRemoval: true}}),
        },
      }),
    onError: () => toast.error(t('Unable to remove item')),
  });

  return (
    <Container position="relative" padding="xl" borderBottom="primary">
      {props => (
        <ItemRow {...props} data-inbox-item data-selected={isSelected}>
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
              {item.isUnread && (
                <UnreadIndicator data-test-id="unread-inbox-item-indicator" />
              )}
            </Flex>
            <Flex column="3" row="1" gap="md" align="center" justify="between">
              <Flex gap="sm" align="center" minWidth={0}>
                {linkProps => (
                  <ItemLink
                    {...linkProps}
                    to={{
                      pathname: getInboxItemPath(organization, item),
                      query: {...filters},
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
              <Grid
                columns="max-content"
                align="center"
                justifyItems="end"
                flexShrink={0}
              >
                <Container column="1" row="1">
                  <Text data-inbox-item-timestamp size="sm" variant="muted" wrap="nowrap">
                    <TimeSince
                      date={item.lastActivityAt}
                      unitStyle="extraShort"
                      suffix=""
                      disabledAbsoluteTooltip
                    />
                  </Text>
                </Container>
                <Container column="1" row="1">
                  {actionProps => (
                    <ItemActions {...actionProps}>
                      <DropdownMenu
                        size="sm"
                        position="bottom-end"
                        strategy="fixed"
                        isDisabled={isUpdating || isRemoving}
                        trigger={triggerProps => (
                          <OverlayTrigger.IconButton
                            {...triggerProps}
                            aria-label={t('Actions for %s', title)}
                            icon={<IconEllipsis />}
                            size="xs"
                            variant="transparent"
                          />
                        )}
                        items={[
                          {
                            key: 'read-state',
                            label: item.isUnread
                              ? t('Mark as read')
                              : t('Mark as unread'),
                            leadingItems: item.isUnread ? (
                              <IconCheckmark />
                            ) : (
                              <IconMail />
                            ),
                            onAction: () =>
                              updateInboxItems(
                                {selection: [item.id], update: {isRead: item.isUnread}},
                                {
                                  onError: () =>
                                    toast.error(t('Unable to update read status')),
                                }
                              ),
                          },
                          {
                            key: 'remove',
                            label: t('Remove'),
                            leadingItems: <IconDelete />,
                            onAction: () => {
                              if (checkboxState.isSelected(item.id)) {
                                checkboxState.toggleSelected(item.id);
                              }
                              removeInboxItems({ids: [item.id]});
                            },
                          },
                        ]}
                      />
                    </ItemActions>
                  )}
                </Container>
              </Grid>
            </Flex>
            <Container column="3" row="2" minWidth={0}>
              <Text size="sm" variant="muted" ellipsis>
                {item.latestEvent.summary}
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

  &:hover,
  &:focus-within,
  &:has([aria-expanded='true']) {
    [data-inbox-item-timestamp] {
      opacity: 0;
    }
  }

  @media (hover: none) {
    [data-inbox-item-timestamp] {
      opacity: 0;
    }
  }

  &[data-selected='true'] {
    background: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
  }
`;

const ItemActions = styled('div')`
  z-index: 1;
  opacity: 0;
  pointer-events: none;

  [data-inbox-item]:hover &,
  [data-inbox-item]:focus-within &,
  &:has([aria-expanded='true']) {
    opacity: 1;
    pointer-events: auto;
  }

  @media (hover: none) {
    opacity: 1;
    pointer-events: auto;
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
