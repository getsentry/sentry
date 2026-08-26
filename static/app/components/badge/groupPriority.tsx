import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import type {DropdownMenuProps, MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {Placeholder} from 'sentry/components/placeholder';
import {IconChevron, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Activity} from 'sentry/types/group';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';
import type {AvatarUser} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type GroupPriorityDropdownProps = {
  groupId: string;
  onChange: (value: PriorityLevel) => void;
  value: PriorityLevel;
  disabled?: boolean;
  lastEditedBy?: 'system' | AvatarUser;
  trigger?: GroupPriorityTrigger;
};

type DropdownMenuTriggerProps = Parameters<NonNullable<DropdownMenuProps['trigger']>>[0];

export interface GroupPriorityTriggerContext {
  ariaLabel: string;
  bars: 1 | 2 | 3;
  disabled: boolean;
  priority: PriorityLevel;
  tooltip: React.ReactNode;
}

export type GroupPriorityTrigger = (
  props: DropdownMenuTriggerProps,
  isOpen: boolean,
  context: GroupPriorityTriggerContext
) => React.ReactNode;

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

export const GROUP_PRIORITY_BARS: Record<PriorityLevel, 1 | 2 | 3> = {
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
    label: <GroupPriorityBadge showLabel priority={priority} />,
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

function GroupPriorityLearnMore() {
  const organization = useOrganization();
  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'issue_priority',
    organization,
  });

  if (isLoading || isError) {
    return null;
  }

  if (isPromptDismissed) {
    return <DataConsentLearnMore />;
  }

  return (
    <LearnMoreWrapper>
      <BannerStar1 src={bannerStar} />
      <BannerStar2 src={bannerStar} />
      <BannerStar3 src={bannerStar} />
      <p>
        <strong>{t('Time to prioritize')}</strong>
      </p>
      <p>
        {t(
          'Use priority to make your issue stream more actionable. Sentry will automatically assign a priority score to new issues.'
        )}
      </p>
      <LinkButton
        href="https://docs.sentry.io/product/issues/issue-priority/"
        external
        size="xs"
      >
        {t('Learn more')}
      </LinkButton>
      <DismissButton
        size="zero"
        variant="transparent"
        icon={<IconClose size="xs" />}
        aria-label={t('Dismiss')}
        onClick={() => dismissPrompt()}
      />
    </LearnMoreWrapper>
  );
}

export function GroupPriorityDropdown({
  groupId,
  value,
  onChange,
  lastEditedBy,
  disabled = false,
  trigger,
}: GroupPriorityDropdownProps) {
  const options: MenuItemProps[] = useMemo(
    () => makeGroupPriorityDropdownOptions({onChange}),
    [onChange]
  );
  const triggerContext: GroupPriorityTriggerContext = {
    ariaLabel: t('Modify issue priority'),
    bars: GROUP_PRIORITY_BARS[value],
    disabled,
    priority: value,
    tooltip: disabled
      ? t('You cannot manually update the priority of a metric issue.')
      : t('Update the priority of this issue.'),
  };

  return (
    <DropdownMenu
      isDisabled={disabled}
      size="sm"
      menuTitle={
        <Flex align="end" justify="between">
          <div>{t('Set Priority')}</div>
        </Flex>
      }
      minMenuWidth={230}
      trigger={(triggerProps, isOpen) =>
        trigger ? (
          trigger(triggerProps, isOpen, triggerContext)
        ) : (
          <DropdownButton
            {...triggerProps}
            aria-label={triggerContext.ariaLabel}
            size="zero"
            disabled={triggerContext.disabled}
            tooltipProps={{title: triggerContext.tooltip}}
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
          <GroupPriorityLearnMore />
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

const LearnMoreWrapper = styled('div')`
  position: relative;
  max-width: 230px;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  padding: ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  overflow: hidden;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.tokens.background.tertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );

  p {
    margin: 0 0 ${p => p.theme.space.xs} 0;
  }
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${p => p.theme.space.md};
  right: ${p => p.theme.space.lg};
  color: ${p => p.theme.tokens.content.secondary};
`;

const BannerStar1 = styled('img')`
  position: absolute;
  bottom: 10px;
  right: 100px;
`;
const BannerStar2 = styled('img')`
  position: absolute;
  top: 10px;
  right: 60px;
  transform: rotate(-20deg) scale(0.8);
`;
const BannerStar3 = styled('img')`
  position: absolute;
  bottom: 30px;
  right: 20px;
  transform: rotate(60deg) scale(0.85);
`;
