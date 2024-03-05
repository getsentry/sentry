import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import Tag from 'sentry/components/tag';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types';

type GroupPriorityDropdownProps = {
  onChange: (value: PriorityLevel) => void;
  value: PriorityLevel;
};

type GroupPriorityBadgeProps = {
  priority: PriorityLevel;
  children?: React.ReactNode;
};

const PRIORITY_KEY_TO_LABEL: Record<PriorityLevel, string> = {
  [PriorityLevel.HIGH]: t('High'),
  [PriorityLevel.MEDIUM]: t('Med'),
  [PriorityLevel.LOW]: t('Low'),
};

const PRIORITY_OPTIONS = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

function getTagTypeForPriority(priority: string): keyof Theme['tag'] {
  switch (priority) {
    case PriorityLevel.HIGH:
      return 'error';
    case PriorityLevel.MEDIUM:
      return 'warning';
    case PriorityLevel.LOW:
    default:
      return 'default';
  }
}

export function GroupPriorityBadge({priority, children}: GroupPriorityBadgeProps) {
  return (
    <StyledTag type={getTagTypeForPriority(priority)}>
      {PRIORITY_KEY_TO_LABEL[priority] ?? t('Unknown')}
      {children}
    </StyledTag>
  );
}

export function GroupPriorityDropdown({value, onChange}: GroupPriorityDropdownProps) {
  const options: MenuItemProps[] = useMemo(() => {
    return PRIORITY_OPTIONS.map(priority => ({
      textValue: PRIORITY_KEY_TO_LABEL[priority],
      key: priority,
      label: <GroupPriorityBadge priority={priority} />,
      onAction: () => onChange(priority),
    }));
  }, [onChange]);

  return (
    <DropdownMenu
      size="sm"
      menuTitle={t('Set Priority To...')}
      minMenuWidth={160}
      trigger={triggerProps => (
        <DropdownButton
          {...triggerProps}
          aria-label={t('Modify issue priority')}
          size="zero"
        >
          <GroupPriorityBadge priority={value}>
            <IconChevron direction="down" size="xs" />
          </GroupPriorityBadge>
        </DropdownButton>
      )}
      items={options}
    />
  );
}

const DropdownButton = styled(Button)`
  font-weight: normal;
  border: none;
  padding: 0;
  height: unset;
  border-radius: 10px;
`;

const StyledTag = styled(Tag)`
  span {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
  }
`;
