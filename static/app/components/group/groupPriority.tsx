import {Fragment, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button, LinkButton} from 'sentry/components/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import Placeholder from 'sentry/components/placeholder';
import Tag from 'sentry/components/tag';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type Activity,
  type AvatarUser,
  GroupActivityType,
  PriorityLevel,
} from 'sentry/types';
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

export function GroupPriorityBadge({priority, children}: GroupPriorityBadgeProps) {
  return (
    <StyledTag type={getTagTypeForPriority(priority)}>
      {PRIORITY_KEY_TO_LABEL[priority] ?? t('Unknown')}
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

function GroupPriorityFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    messagePlaceholder: t('How can we make priority better for you?'),
  });

  if (!feedback) {
    return null;
  }

  return (
    <StyledButton
      ref={buttonRef}
      size="zero"
      borderless
      onClick={e => e.stopPropagation()}
    >
      {t('Give Feedback')}
    </StyledButton>
  );
}

function GroupPriorityLearnMore() {
  const organization = useOrganization();
  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'issue_priority',
    organization,
  });

  if (isLoading || isError || isPromptDismissed) {
    return null;
  }

  return (
    <LearnMoreWrapper>
      <BannerStar1 src={bannerStar} />
      <BannerStar2 src={bannerStar} />
      <BannerStar3 src={bannerStar} />
      <p>
        <strong>{t('Organize, prioritize!')}</strong>
      </p>
      <p>
        {t(
          'Use priorities to clean up your issues view. Sentry will automatically assign a priority to new issues. Low-priority issues will be hidden from Prioritized.'
        )}
      </p>
      <LinkButton
        href="https://docs.sentry.io/product/issues/issue-priority/"
        external
        size="xs"
      >
        {t('Learn More')}
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
      menuTitle={
        <MenuTitleContainer>
          <div>{t('Set Priority')}</div>
          <GroupPriorityFeedback />
        </MenuTitleContainer>
      }
      minMenuWidth={230}
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

const InlinePlaceholder = styled(Placeholder)`
  display: inline-block;
  vertical-align: middle;
`;

const MenuTitleContainer = styled('div')`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
`;

const StyledButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: normal;
  padding: 0;
  border: none;

  &:hover {
    color: ${p => p.theme.subText};
  }
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
