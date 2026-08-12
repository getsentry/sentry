import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ActorAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {User} from 'sentry/types/user';

type AssignmentSource =
  | 'codeowners'
  | 'ownershipRule'
  | 'projectOwnership'
  | 'seerSuggested'
  | 'suspectCommit'
  | 'suspectCommitter';

export type AssignmentDetails = {
  actorLabel?: string;
  isSelfAssigned?: boolean;
  source?: AssignmentSource;
};

type AssigneeBadgeProps = {
  assignedTo?: Actor | undefined;
  assignedUser?: User | undefined;
  assignmentDetails?: AssignmentDetails;
  avatarSize?: number;
  /**
   * Render just the avatar with no surrounding tag pill / background — matches a
   * plain avatar. Defaults to false.
   */
  bare?: boolean;
  chevronDirection?: 'up' | 'down';
  loading?: boolean;
  /**
   * Whether to show the dropdown chevron next to the avatar. Defaults to true.
   * Set to false for a compact, avatar-only trigger.
   */
  showChevron?: boolean;
  showLabel?: boolean;
};

const DEFAULT_AVATAR_SIZE = 16;
const ASSIGNED_TOOLTIP_MAX_WIDTH = 300;

export function AssigneeBadge({
  assignedTo,
  assignedUser,
  assignmentDetails,
  avatarSize = DEFAULT_AVATAR_SIZE,
  showLabel = false,
  showChevron = true,
  bare = false,
  chevronDirection = 'down',
  loading = false,
}: AssigneeBadgeProps) {
  if (loading) {
    const loadingIcon = (
      <LoadingIcon
        avatarSize={avatarSize}
        showLabel={showLabel}
        showChevron={showChevron}
        chevronDirection={chevronDirection}
      />
    );
    return bare ? (
      <BareBadge>{loadingIcon}</BareBadge>
    ) : (
      <StyledTag icon={loadingIcon} variant="muted" />
    );
  }

  if (assignedTo) {
    const assignedIcon = (
      <AssignedIcon
        assignedTo={assignedTo}
        assignedUser={assignedUser}
        avatarSize={avatarSize}
        chevronDirection={chevronDirection}
        showLabel={showLabel}
        showChevron={showChevron}
      />
    );
    return (
      <Tooltip
        isHoverable
        maxWidth={ASSIGNED_TOOLTIP_MAX_WIDTH}
        title={
          <AssignedTooltip
            assignedTo={assignedTo}
            assignmentDetails={assignmentDetails}
          />
        }
        skipWrapper
      >
        {bare ? (
          <BareBadge>{assignedIcon}</BareBadge>
        ) : (
          <StyledTag icon={assignedIcon} variant="muted" />
        )}
      </Tooltip>
    );
  }

  const unassignedIcon = (
    <UnassignedIcon
      avatarSize={avatarSize}
      showLabel={showLabel}
      showChevron={showChevron}
      chevronDirection={chevronDirection}
    />
  );
  return (
    <Tooltip isHoverable title={<UnassignedTooltip />} skipWrapper>
      {bare ? (
        <BareBadge>{unassignedIcon}</BareBadge>
      ) : (
        <UnassignedTag icon={unassignedIcon} variant="muted" />
      )}
    </Tooltip>
  );
}

function getActorLabel(actor: Actor) {
  return `${actor.type === 'team' ? '#' : ''}${actor.name}`;
}

function getAssignmentSourceLabel(source: AssignmentDetails['source']) {
  switch (source) {
    case 'codeowners':
      return t('Matching Codeowners Rule');
    case 'ownershipRule':
    case 'projectOwnership':
      return t('Matching Issue Owners Rule');
    case 'suspectCommit':
    case 'suspectCommitter':
      return t('Based on commit data');
    case 'seerSuggested':
      return t('Seer Suggestion');
    default:
      return null;
  }
}

function LoadingIcon({
  avatarSize,
  showLabel,
  showChevron,
  chevronDirection,
}: {
  avatarSize: number;
  chevronDirection: NonNullable<AssigneeBadgeProps['chevronDirection']>;
  showChevron: boolean;
  showLabel: boolean;
}) {
  return (
    <Fragment>
      <StyledLoadingIndicator mini relative size={avatarSize} />
      {showLabel && 'Loading...'}
      {showChevron && (
        <IconChevron variant="muted" direction={chevronDirection} size="xs" />
      )}
    </Fragment>
  );
}

function AssignedIcon({
  assignedTo,
  assignedUser,
  avatarSize,
  chevronDirection,
  showLabel,
  showChevron,
}: {
  assignedTo: Actor;
  avatarSize: number;
  chevronDirection: NonNullable<AssigneeBadgeProps['chevronDirection']>;
  showChevron: boolean;
  showLabel: boolean;
  assignedUser?: User;
}) {
  const theme = useTheme();

  const avatar =
    assignedTo.type === 'user' ? (
      <UserAvatar
        user={assignedUser ?? assignedTo}
        className="avatar"
        size={avatarSize}
        hasTooltip={false}
        data-test-id="assigned-avatar"
      />
    ) : (
      <ActorAvatar
        actor={assignedTo}
        className="avatar"
        size={avatarSize}
        hasTooltip={false}
        data-test-id="assigned-avatar"
        style={{marginLeft: theme.space.xs}}
      />
    );

  return (
    <Fragment>
      {avatar}
      {showLabel && <AssigneeLabel ellipsis>{getActorLabel(assignedTo)}</AssigneeLabel>}
      {showChevron && (
        <IconChevron variant="muted" direction={chevronDirection} size="xs" />
      )}
    </Fragment>
  );
}

function AssignedTooltip({
  assignedTo,
  assignmentDetails,
}: {
  assignedTo: Actor;
  assignmentDetails?: AssignmentDetails;
}) {
  const assignedToLabel = getActorLabel(assignedTo);
  const sourceLabel = getAssignmentSourceLabel(assignmentDetails?.source);

  if (assignmentDetails?.actorLabel || sourceLabel) {
    return (
      <Stack gap="xs">
        <Text as="div" align="left" wrap="nowrap">
          {tct('Assigned to [name]', {name: assignedToLabel})}
        </Text>
        {assignmentDetails?.actorLabel && (
          <Text as="div" align="left" variant="muted" wrap="nowrap">
            {assignmentDetails.isSelfAssigned
              ? t('Self-assigned')
              : tct('By [actor]', {actor: assignmentDetails.actorLabel})}
          </Text>
        )}
        {sourceLabel && (
          <Text as="div" align="left" variant="muted">
            {sourceLabel}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Text as="div" align="center" wrap="nowrap">
      {tct('Assigned to [name]', {name: assignedToLabel})}
    </Text>
  );
}

function UnassignedIcon({
  avatarSize,
  showLabel,
  showChevron,
  chevronDirection,
}: {
  avatarSize: number;
  chevronDirection: NonNullable<AssigneeBadgeProps['chevronDirection']>;
  showChevron: boolean;
  showLabel: boolean;
}) {
  return (
    <Fragment>
      <Placeholder
        shape="circle"
        testId="unassigned-avatar"
        width={`${avatarSize}px`}
        height={`${avatarSize}px`}
      />
      {showLabel && <Fragment>Unassigned</Fragment>}
      {showChevron && (
        <IconChevron variant="muted" direction={chevronDirection} size="xs" />
      )}
    </Fragment>
  );
}

function UnassignedTooltip() {
  return (
    <Stack gap="xs">
      <Text as="div" align="left">
        {t('Unassigned')}
      </Text>
      <Text as="div" align="left" variant="muted">
        {tct('You can auto-assign issues by adding [issueOwners:Issue Owner rules].', {
          issueOwners: (
            <TooltipSubExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
          ),
        })}
      </Text>
    </Stack>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: inline-flex;
  align-items: center;
`;

const AssigneeLabel = styled(Text)`
  max-width: 114px;
`;

const StyledTag = styled(Tag)`
  gap: ${p => p.theme.space.xs};
  height: 24px;
  padding: ${p => p.theme.space.xs};
  padding-right: ${p => p.theme.space['2xs']};
  color: ${p => p.theme.tokens.content.secondary};
`;

const UnassignedTag = styled(StyledTag)`
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  background-color: transparent;
`;

// Bare variant: just the avatar (+ optional chevron) with no tag pill/background.
const BareBadge = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space['2xs']};
`;

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;

  :hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
