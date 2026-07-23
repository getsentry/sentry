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
  chevronDirection?: 'up' | 'down';
  loading?: boolean;
  showLabel?: boolean;
};

const AVATAR_SIZE = 16;
const ASSIGNED_TOOLTIP_MAX_WIDTH = 300;

export function AssigneeBadge({
  assignedTo,
  assignedUser,
  assignmentDetails,
  showLabel = false,
  chevronDirection = 'down',
  loading = false,
}: AssigneeBadgeProps) {
  if (loading) {
    return (
      <StyledTag
        icon={<LoadingIcon showLabel={showLabel} chevronDirection={chevronDirection} />}
        variant="muted"
      />
    );
  }

  if (assignedTo) {
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
        <StyledTag
          icon={
            <AssignedIcon
              assignedTo={assignedTo}
              assignedUser={assignedUser}
              chevronDirection={chevronDirection}
              showLabel={showLabel}
            />
          }
          variant="muted"
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip isHoverable title={<UnassignedTooltip />} skipWrapper>
      <UnassignedTag
        icon={
          <UnassignedIcon showLabel={showLabel} chevronDirection={chevronDirection} />
        }
        variant="muted"
      />
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
  showLabel,
  chevronDirection,
}: {
  chevronDirection: NonNullable<AssigneeBadgeProps['chevronDirection']>;
  showLabel: boolean;
}) {
  return (
    <Fragment>
      <StyledLoadingIndicator mini relative size={AVATAR_SIZE} />
      {showLabel && 'Loading...'}
      <IconChevron variant="muted" direction={chevronDirection} size="xs" />
    </Fragment>
  );
}

function AssignedIcon({
  assignedTo,
  assignedUser,
  chevronDirection,
  showLabel,
}: {
  assignedTo: Actor;
  chevronDirection: NonNullable<AssigneeBadgeProps['chevronDirection']>;
  showLabel: boolean;
  assignedUser?: User;
}) {
  const theme = useTheme();

  const avatar =
    assignedTo.type === 'user' ? (
      <UserAvatar
        user={assignedUser ?? assignedTo}
        className="avatar"
        size={AVATAR_SIZE}
        hasTooltip={false}
        data-test-id="assigned-avatar"
      />
    ) : (
      <ActorAvatar
        actor={assignedTo}
        className="avatar"
        size={AVATAR_SIZE}
        hasTooltip={false}
        data-test-id="assigned-avatar"
        style={{marginLeft: theme.space.xs}}
      />
    );

  return (
    <Fragment>
      {avatar}
      {showLabel && <AssigneeLabel ellipsis>{getActorLabel(assignedTo)}</AssigneeLabel>}
      <IconChevron variant="muted" direction={chevronDirection} size="xs" />
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
  showLabel,
  chevronDirection,
}: {
  chevronDirection: NonNullable<AssigneeBadgeProps['chevronDirection']>;
  showLabel: boolean;
}) {
  return (
    <Fragment>
      <Placeholder
        shape="circle"
        testId="unassigned-avatar"
        width={`${AVATAR_SIZE}px`}
        height={`${AVATAR_SIZE}px`}
      />
      {showLabel && <Fragment>Unassigned</Fragment>}
      <IconChevron variant="muted" direction={chevronDirection} size="xs" />
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

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;

  :hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
