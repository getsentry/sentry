import type {ComponentType} from 'react';
import {IconFile} from '@sentry/icons/file';
import {IconFilter} from '@sentry/icons/filter';
import {IconSubscribed} from '@sentry/icons/subscribed';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import {IconUser} from '@sentry/icons/user';

import {Chip} from '@sentry/scraps/chip';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

import {
  INBOX_EVENT_TYPES,
  INBOX_RECIPIENTS,
  INBOX_SUBJECT_TYPES,
  type InboxFilters,
} from './types';
import type {SetInboxFilters} from './useInboxFilters';
import {
  hasInboxFilters,
  INBOX_EVENT_TYPE_CONFIG,
  INBOX_RECIPIENT_LABELS,
  INBOX_SUBJECT_CONFIG,
} from './utils';

interface InboxFilterCategory {
  icon: ComponentType<SVGIconProps>;
  key: keyof InboxFilters;
  label: string;
}

const SUBJECT_TYPE_CATEGORY: InboxFilterCategory = {
  key: 'subjectType',
  label: t('Subject'),
  icon: IconFile,
};

const EVENT_TYPE_CATEGORY: InboxFilterCategory = {
  key: 'eventType',
  label: t('Type'),
  icon: IconSubscribed,
};

const RECIPIENT_CATEGORY: InboxFilterCategory = {
  key: 'recipient',
  label: t('Recipient'),
  icon: IconUser,
};

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter(existing => existing !== value)
    : [...values, value];
}

function getFilterMenuItems(
  filters: InboxFilters,
  setFilters: SetInboxFilters
): MenuItemProps[] {
  const SubjectTypeIcon = SUBJECT_TYPE_CATEGORY.icon;
  const EventTypeIcon = EVENT_TYPE_CATEGORY.icon;
  const RecipientIcon = RECIPIENT_CATEGORY.icon;

  return [
    {
      key: RECIPIENT_CATEGORY.key,
      label: RECIPIENT_CATEGORY.label,
      leadingItems: <RecipientIcon />,
      submenu: true,
      children: INBOX_RECIPIENTS.map(recipient => ({
        key: `recipient:${recipient}`,
        label: INBOX_RECIPIENT_LABELS[recipient],
        isSelected: filters.recipient.includes(recipient),
        closeOnSelect: false,
        onAction: () =>
          setFilters(prev => ({recipient: toggleValue(prev.recipient, recipient)})),
      })),
    },
    {
      key: SUBJECT_TYPE_CATEGORY.key,
      label: SUBJECT_TYPE_CATEGORY.label,
      leadingItems: <SubjectTypeIcon />,
      submenu: {search: {placeholder: t('Filter\u2026')}},
      children: INBOX_SUBJECT_TYPES.map(subjectType => ({
        key: `subjectType:${subjectType}`,
        label: INBOX_SUBJECT_CONFIG[subjectType].label,
        isSelected: filters.subjectType.includes(subjectType),
        closeOnSelect: false,
        onAction: () =>
          setFilters(prev => ({subjectType: toggleValue(prev.subjectType, subjectType)})),
      })),
    },
    {
      key: EVENT_TYPE_CATEGORY.key,
      label: EVENT_TYPE_CATEGORY.label,
      leadingItems: <EventTypeIcon />,
      submenu: {search: {placeholder: t('Filter\u2026')}},
      children: INBOX_SUBJECT_TYPES.map(subjectType => ({
        key: `eventTypeSection:${subjectType}`,
        label: INBOX_SUBJECT_CONFIG[subjectType].label,
        children: INBOX_EVENT_TYPES.filter(
          eventType => INBOX_EVENT_TYPE_CONFIG[eventType].subjectType === subjectType
        ).map(eventType => ({
          key: `eventType:${eventType}`,
          label: INBOX_EVENT_TYPE_CONFIG[eventType].label,
          isSelected: filters.eventType.includes(eventType),
          closeOnSelect: false,
          onAction: () =>
            setFilters(prev => ({eventType: toggleValue(prev.eventType, eventType)})),
        })),
      })),
    },
  ];
}

interface InboxFilterControlProps {
  filters: InboxFilters;
  setFilters: SetInboxFilters;
}

export function InboxFilterMenu({filters, setFilters}: InboxFilterControlProps) {
  return (
    <DropdownMenu
      size="sm"
      items={getFilterMenuItems(filters, setFilters)}
      position="bottom-end"
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="sm"
          icon={<IconFilter />}
          variant="transparent"
          aria-label={t('Filter')}
        />
      )}
    />
  );
}

export function InboxFilterPills({filters, setFilters}: InboxFilterControlProps) {
  if (!hasInboxFilters(filters)) {
    return null;
  }

  return (
    <Flex wrap="wrap" align="center" gap="sm">
      {filters.recipient.length > 0 && (
        <InboxFilterPill
          category={RECIPIENT_CATEGORY}
          valueLabels={filters.recipient.map(
            recipient => INBOX_RECIPIENT_LABELS[recipient]
          )}
          onRemove={() => setFilters({recipient: null})}
        />
      )}
      {filters.subjectType.length > 0 && (
        <InboxFilterPill
          category={SUBJECT_TYPE_CATEGORY}
          valueLabels={filters.subjectType.map(
            subjectType => INBOX_SUBJECT_CONFIG[subjectType].label
          )}
          onRemove={() => setFilters({subjectType: null})}
        />
      )}
      {filters.eventType.length > 0 && (
        <InboxFilterPill
          category={EVENT_TYPE_CATEGORY}
          valueLabels={filters.eventType.map(
            eventType => INBOX_EVENT_TYPE_CONFIG[eventType].label
          )}
          onRemove={() => setFilters({eventType: null})}
        />
      )}
    </Flex>
  );
}

interface InboxFilterPillProps {
  category: InboxFilterCategory;
  onRemove: () => void;
  valueLabels: string[];
}

function InboxFilterPill({category, valueLabels, onRemove}: InboxFilterPillProps) {
  const CategoryIcon = category.icon;
  const [firstLabel, ...otherLabels] = valueLabels;

  return (
    <Chip.Root size="sm">
      <Flex align="center">
        <CategoryIcon size="xs" variant="muted" />
      </Flex>
      <Chip.Property>{category.label}</Chip.Property>
      <Chip.Operator>{t('is')}</Chip.Operator>
      <Chip.Value>
        <Tooltip title={valueLabels.join(', ')} disabled={otherLabels.length === 0}>
          {otherLabels.length > 0
            ? t('%s +%s', firstLabel, otherLabels.length)
            : firstLabel}
        </Tooltip>
      </Chip.Value>
      <Chip.Dismiss
        aria-label={t('Remove %s filter', category.label)}
        onClick={onRemove}
      />
    </Chip.Root>
  );
}
