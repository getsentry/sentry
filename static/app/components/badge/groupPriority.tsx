import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {Button, LinkButton} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Activity} from 'sentry/types/group';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type GroupPriorityDropdownProps = {
  groupId: string;
  onChange: (value: PriorityLevel) => void;
  value: PriorityLevel;
  lastEditedBy?: 'system' | AvatarUser;
};

type GroupPriorityBadgeProps = {
  priority: PriorityLevel;
  children?: React.ReactNode;
  showLabel?: boolean;
  variant?: 'default' | 'signal';
};

const PRIORITY_KEY_TO_LABEL: Record<PriorityLevel, string> = {
  [PriorityLevel.HIGH]: t('High'),
  [PriorityLevel.MEDIUM]: t('Med'),
  [PriorityLevel.LOW]: t('Low'),
};

const PRIORITY_OPTIONS = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

function getTagTypeForPriority(priority: string): TagProps['type'] {
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

function useLastEditedBy({
  groupId,
  lastEditedBy: incomingLastEditedBy,
}: Pick<GroupPriorityDropdownProps, 'groupId' | 'lastEditedBy'>) {
  const {data} = useApiQuery<{activity: Activity[]}>([`/issues/${groupId}/activities/`], {
    enabled: !defined(incomingLastEditedBy),
    staleTime: 0,
  });

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
  hasIssueStreamTableLayout,
}: {
  hasIssueStreamTableLayout: boolean;
  onChange: (value: PriorityLevel) => void;
}) {
  return PRIORITY_OPTIONS.map(priority => ({
    textValue: PRIORITY_KEY_TO_LABEL[priority],
    key: priority,
    label: (
      <GroupPriorityBadge
        variant={hasIssueStreamTableLayout ? 'signal' : 'default'}
        priority={priority}
      />
    ),
    onAction: () => onChange(priority),
  }));
}

export function GroupPriorityBadge({
  priority,
  showLabel = true,
  variant = 'default',
  children,
}: GroupPriorityBadgeProps) {
  const bars =
    priority === PriorityLevel.HIGH ? 3 : priority === PriorityLevel.MEDIUM ? 2 : 1;
  const label = PRIORITY_KEY_TO_LABEL[priority] ?? t('Unknown');

  return (
    <StyledTag
      type={variant === 'signal' ? 'default' : getTagTypeForPriority(priority)}
      icon={variant === 'signal' && <IconCellSignal bars={bars} />}
    >
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

const DataConsentLearnMore = HookOrDefault({
  hookName: 'component:data-consent-priority-learn-more',
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
        {organization.features.includes('issue-stream-custom-views')
          ? t(
              'Use priority to make your issue stream more actionable. Sentry will automatically assign a priority score to new issues.'
            )
          : t(
              'Use priority to make your issue stream more actionable. Sentry will automatically assign a priority score to new issues and filter low priority issues from the default view.'
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
        borderless
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
}: GroupPriorityDropdownProps) {
  const organization = useOrganization();
  const hasIssueStreamTableLayout = organization.features.includes(
    'issue-stream-table-layout'
  );

  const options: MenuItemProps[] = useMemo(
    () => makeGroupPriorityDropdownOptions({onChange, hasIssueStreamTableLayout}),
    [onChange, hasIssueStreamTableLayout]
  );

  return (
    <DropdownMenu
      size="sm"
      menuTitle={
        <MenuTitleContainer>
          <div>{t('Set Priority')}</div>
        </MenuTitleContainer>
      }
      minMenuWidth={230}
      trigger={(triggerProps, isOpen) => (
        <DropdownButton
          {...triggerProps}
          aria-label={t('Modify issue priority')}
          size="zero"
        >
          <GroupPriorityBadge
            showLabel={!hasIssueStreamTableLayout}
            variant={hasIssueStreamTableLayout ? 'signal' : 'default'}
            priority={value}
          >
            <Chevron light direction={isOpen ? 'up' : 'down'} size="small" />
          </GroupPriorityBadge>
        </DropdownButton>
      )}
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

const DropdownButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
  border: none;
  padding: 0;
  height: unset;
  border-radius: 20px;
  box-shadow: none;
`;

const StyledTag = styled(Tag)`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
  position: relative;
  height: 24px;
  overflow: hidden;
`;

const InlinePlaceholder = styled(Placeholder)`
  display: inline-block;
  vertical-align: middle;
`;

const MenuTitleContainer = styled('div')`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
`;

const StyledFooter = styled(DropdownMenuFooter)`
  max-width: 230px;
  ${p => p.theme.overflowEllipsis};
`;

const TruncatedFooterText = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const LearnMoreWrapper = styled('div')`
  position: relative;
  max-width: 230px;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1.5)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  overflow: hidden;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );

  p {
    margin: 0 0 ${space(0.5)} 0;
  }
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1.5)};
  color: ${p => p.theme.subText};
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
