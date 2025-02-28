import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Chevron} from 'sentry/components/chevron';
import {Tag} from 'sentry/components/core/badge/tag';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
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
  const theme = useTheme();
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
          <div
            style={{color: theme.textColor}}
          >{`${actor.type === 'team' ? '#' : ''}${actor.name}`}</div>
        )}
        <Chevron light color="subText" direction={chevronDirection} size="small" />
      </Fragment>
    );
  };

  const loadingIcon = (
    <Fragment>
      <StyledLoadingIndicator mini hideMessage relative size={AVATAR_SIZE} />
      {showLabel && 'Loading...'}
      <Chevron light color="subText" direction={chevronDirection} size="small" />
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
      <Chevron light color="subText" direction={chevronDirection} size="small" />
    </Fragment>
  );

  return loading ? (
    <StyledTag icon={loadingIcon} />
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
    >
      <StyledTag icon={makeAssignedIcon(assignedTo)} />
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
    >
      <UnassignedTag icon={unassignedIcon} />
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

const StyledTag = styled(Tag)`
  gap: ${space(0.5)};
  height: 24px;
  padding: ${space(0.5)};
  padding-right: ${space(0.25)};
  color: ${p => p.theme.subText};
`;

const UnassignedTag = styled(Tag)`
  border-style: dashed;
`;

const TooltipSubtext = styled('div')`
  color: ${p => p.theme.subText};
`;

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.subText};
  text-decoration: underline;

  :hover {
    color: ${p => p.theme.subText};
  }
`;
