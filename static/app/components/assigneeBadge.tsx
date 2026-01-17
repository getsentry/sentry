import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {Tag} from 'sentry/components/core/badge';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {SuggestedOwnerReason} from 'sentry/types/group';

type AssigneeBadgeProps = {
  assignedTo?: Actor | undefined;
  assignmentReason?: SuggestedOwnerReason;
  chevronDirection?: 'up' | 'down';
  isTooltipDisabled?: boolean;
  loading?: boolean;
  showLabel?: boolean;
};

const AVATAR_SIZE = 16;

export function AssigneeBadge({
  assignedTo,
  assignmentReason,
  showLabel = false,
  chevronDirection = 'down',
  loading = false,
  isTooltipDisabled,
}: AssigneeBadgeProps) {
  const suggestedReasons: Record<SuggestedOwnerReason, React.ReactNode> = {
    suspectCommit: tct('Based on [commit:commit data]', {
      commit: (
        <TooltipSubExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/configure-scms/" />
      ),
    }),
    ownershipRule: t('Matching Issue Owners Rule'),
    projectOwnership: t('Matching Issue Owners Rule'),
    codeowners: t('Matching Codeowners Rule'),
  };

  const makeAssignedIcon = (actor: Actor) => {
    return (
      <Fragment>
        <ActorAvatar
          actor={actor}
          className="avatar"
          size={AVATAR_SIZE}
          hasTooltip={false}
          data-test-id="assigned-avatar"
          // Team avatars need extra left margin since the
          // square team avatar is being fit into a rounded borders
          style={{
            marginLeft: actor.type === 'team' ? space(0.5) : '0',
          }}
        />
        {showLabel && (
          <StyledText>{`${actor.type === 'team' ? '#' : ''}${actor.name}`}</StyledText>
        )}
        <IconChevron variant="muted" direction={chevronDirection} size="xs" />
      </Fragment>
    );
  };

  const loadingIcon = (
    <Fragment>
      <StyledLoadingIndicator mini relative size={AVATAR_SIZE} />
      {showLabel && 'Loading...'}
      <IconChevron variant="muted" direction={chevronDirection} size="xs" />
    </Fragment>
  );

  const unassignedIcon = (
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

  return loading ? (
    <StyledTag icon={loadingIcon} variant="muted" />
  ) : assignedTo ? (
    <Tooltip
      isHoverable
      disabled={isTooltipDisabled}
      title={
        <TooltipWrapper>
          {t('Assigned to ')}
          {assignedTo.type === 'team' ? `#${assignedTo.name}` : assignedTo.name}
          {assignmentReason && (
            <TooltipSubtext>{suggestedReasons[assignmentReason]}</TooltipSubtext>
          )}
        </TooltipWrapper>
      }
      skipWrapper
    >
      <StyledTag icon={makeAssignedIcon(assignedTo)} variant="muted" />
    </Tooltip>
  ) : (
    <Tooltip
      isHoverable
      disabled={isTooltipDisabled}
      title={
        <TooltipWrapper>
          <div>{t('Unassigned')}</div>
          <TooltipSubtext>
            {tct(
              'You can auto-assign issues by adding [issueOwners:Issue Owner rules].',
              {
                issueOwners: (
                  <TooltipSubExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
                ),
              }
            )}
          </TooltipSubtext>
        </TooltipWrapper>
      }
      skipWrapper
    >
      <UnassignedTag icon={unassignedIcon} variant="muted" />
    </Tooltip>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: inline-flex;
  align-items: center;
`;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const StyledText = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  max-width: 114px;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledTag = styled(Tag)`
  gap: ${space(0.5)};
  height: 24px;
  padding: ${space(0.5)};
  padding-right: ${space(0.25)};
  color: ${p => p.theme.tokens.content.secondary};
`;

const UnassignedTag = styled(StyledTag)`
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  background-color: transparent;
`;

const TooltipSubtext = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;

  :hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
