import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {Placeholder} from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Activity} from 'sentry/types/group';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';
import type {AvatarUser} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useNewIssuePriorityAndAssigneeUI} from 'sentry/utils/useNewIssuePriorityAndAssigneeUI';
import {useOrganization} from 'sentry/utils/useOrganization';

type GroupPriorityDropdownProps = {
  groupId: string;
  onChange: (value: PriorityLevel) => void;
  value: PriorityLevel;
  disabled?: boolean;
  lastEditedBy?: 'system' | AvatarUser;
};

type GroupPriorityBadgeProps = {
  priority: PriorityLevel;
  children?: React.ReactNode;
  showLabel?: boolean;
};

const PRIORITY_KEY_TO_LABEL: Record<PriorityLevel, string> = {
  [PriorityLevel.HIGH]: t('High'),
  [PriorityLevel.MEDIUM]: t('Med'),
  [PriorityLevel.LOW]: t('Low'),
};

const PRIORITY_OPTIONS = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

const GROUP_PRIORITY_BARS: Record<PriorityLevel, 1 | 2 | 3> = {
  [PriorityLevel.HIGH]: 3,
  [PriorityLevel.MEDIUM]: 2,
  [PriorityLevel.LOW]: 1,
};

function useLastEditedBy({
  groupId,
  lastEditedBy: incomingLastEditedBy,
}: Pick<GroupPriorityDropdownProps, 'groupId' | 'lastEditedBy'>) {
  const organization = useOrganization();
  const {data} = useApiQuery<{activity: Activity[]}>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/activities/', {
        path: {organizationIdOrSlug: organization.slug, issueId: groupId},
      }),
    ],
    {
      enabled: !defined(incomingLastEditedBy),
      staleTime: 0,
    }
  );

  const lastEditedBy = useMemo(() => {
    if (incomingLastEditedBy) {
      return incomingLastEditedBy;
    }

    if (!data) {
      return null;
    }

    return (
      data?.activity?.find(activity => activity.type === GroupActivityType.SET_PRIORITY)
        ?.user ?? 'system'
    );
  }, [data, incomingLastEditedBy]);

  return lastEditedBy;
}

export function makeGroupPriorityDropdownOptions({
  onChange,
}: {
  onChange: (value: PriorityLevel) => void;
}) {
  return PRIORITY_OPTIONS.map(priority => ({
    textValue: PRIORITY_KEY_TO_LABEL[priority],
    key: priority,
    label: <GroupPriorityBadge priority={priority} />,
    onAction: () => onChange(priority),
  }));
}

export function GroupPriorityBadge({
  priority,
  showLabel = true,
  children,
}: GroupPriorityBadgeProps) {
  const bars = GROUP_PRIORITY_BARS[priority];
  const label = PRIORITY_KEY_TO_LABEL[priority] ?? t('Unknown');

  return (
    <StyledTag variant="muted" icon={<IconCellSignal bars={bars} />}>
      {showLabel ? label : <VisuallyHidden>{label}</VisuallyHidden>}
      {children}
    </StyledTag>
  );
}

function PriorityChangeActor({
  groupId,
  lastEditedBy,
}: Pick<GroupPriorityDropdownProps, 'groupId' | 'lastEditedBy'>) {
  const resolvedLastEditedBy = useLastEditedBy({groupId, lastEditedBy});

  if (!resolvedLastEditedBy) {
    return <InlinePlaceholder height="1em" width="60px" />;
  }

  if (resolvedLastEditedBy === 'system') {
    return <span>Sentry</span>;
  }

  return (
    <Tooltip skipWrapper title={resolvedLastEditedBy.name}>
      <span>{resolvedLastEditedBy.name}</span>
    </Tooltip>
  );
}

const DataConsentLearnMore = OverrideOrDefault({
  overrideName: 'component:data-consent-priority-learn-more',
  defaultComponent: null,
});

export function GroupPriorityDropdown({
  groupId,
  value,
  onChange,
  lastEditedBy,
  disabled = false,
}: GroupPriorityDropdownProps) {
  const shouldUseNewUI = useNewIssuePriorityAndAssigneeUI();
  const options: MenuItemProps[] = useMemo(
    () => makeGroupPriorityDropdownOptions({onChange}),
    [onChange]
  );
  const tooltip = disabled
    ? t('You cannot manually update the priority of a metric issue.')
    : t('Update the priority of this issue.');

  return (
    <DropdownMenu
      size="sm"
      menuTitle={
        <Flex align="end" justify="between">
          <div>{t('Set Priority')}</div>
        </Flex>
      }
      minMenuWidth={230}
      trigger={(triggerProps, isOpen) =>
        shouldUseNewUI ? (
          <Button
            {...triggerProps}
            aria-label={t(
              'Modify issue priority: %s',
              PRIORITY_KEY_TO_LABEL[value] ?? t('Unknown')
            )}
            disabled={disabled}
            icon={<IconCellSignal bars={GROUP_PRIORITY_BARS[value]} />}
            size="xs"
            tooltipProps={{title: tooltip}}
            variant="secondary"
          />
        ) : (
          <DropdownButton
            {...triggerProps}
            aria-label={t('Modify issue priority')}
            size="zero"
            disabled={disabled}
            tooltipProps={{title: tooltip}}
          >
            <GroupPriorityBadge showLabel={false} priority={value}>
              <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" variant="muted" />
            </GroupPriorityBadge>
          </DropdownButton>
        )
      }
      items={options}
      menuFooter={
        <Fragment>
          <StyledFooter>
            <TruncatedFooterText>
              {tct('Last edited by [name]', {
                name: (
                  <PriorityChangeActor groupId={groupId} lastEditedBy={lastEditedBy} />
                ),
              })}
            </TruncatedFooterText>
          </StyledFooter>
          <DataConsentLearnMore />
        </Fragment>
      }
      shouldCloseOnInteractOutside={target =>
        // Since this can open a feedback modal, we want to ignore interactions with it
        !document.getElementById('sentry-feedback')?.contains(target)
      }
      position="bottom-end"
    />
  );
}

const StyledTag = styled(Tag)`
  gap: ${p => p.theme.space['2xs']};
  position: relative;
  height: 24px;
  overflow: hidden;
`;

const DropdownButton = styled(Button)`
  padding: 0;
  border-radius: ${p => p.theme.radius.full};

  ${StyledTag} {
    border-radius: ${p => p.theme.radius.full};
  }
`;

const InlinePlaceholder = styled(Placeholder)`
  display: inline-block;
  vertical-align: middle;
`;

const StyledFooter = styled(DropdownMenuFooter)`
  max-width: 230px;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TruncatedFooterText = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
