// import {Fragment} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Tag from 'sentry/components/badge/tag';
import {Chevron} from 'sentry/components/chevron';
import ExternalLink from 'sentry/components/links/externalLink';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types';

export function AssigneeBadge({
  assignedTo,
  assignmentReason,
  showLabel = false,
}: {
  assignedTo?: Actor | undefined;
  assignmentReason?: string;
  showLabel?: boolean;
}) {
  // const suggestedReasons: Record<SuggestedOwnerReason, React.ReactNode> = {
  //   suspectCommit: tct('Based on [commit:commit data]', {
  //     commit: (
  //       <TooltipSubExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/configure-scms/" />
  //     ),
  //   }),
  //   ownershipRule: t('Matching Issue Owners Rule'),
  //   projectOwnership: t('Matching Issue Owners Rule'),
  //   codeowners: t('Matching Codeowners Rule'),
  // };
  const AVATAR_SIZE = 16;

  const makeAssignedIcon = (actor: Actor) => {
    return (
      <Fragment>
        <ActorAvatar
          actor={actor}
          className="avatar"
          size={AVATAR_SIZE}
          hasTooltip={false}
        />
        {showLabel && <Fragment>{actor.name}</Fragment>}
        <Chevron direction="down" size="small" />
      </Fragment>
    );
  };

  const makeUnassignedIcon = () => {
    return (
      <Fragment>
        <Placeholder
          shape="circle"
          width={`${AVATAR_SIZE}px`}
          height={`${AVATAR_SIZE}px`}
        />
        {showLabel && <Fragment>Unassigned</Fragment>}
        <Chevron direction="down" size="small" />
      </Fragment>
    );
  };

  const makeAssignedTooltipText = (actor: Actor) => {
    // Cant use StyledTag's tooltipText prop because
    // it screws with the nested div style ()
    return (
      <TooltipWrapper>
        {tct('Assigned to [name]', {
          name: actor.type === 'team' ? `#${actor.name}` : actor.name,
        })}
        {assignmentReason && <TooltipSubtext>{assignmentReason}</TooltipSubtext>}
      </TooltipWrapper>
    );
  };

  const makeUnAssignedTooltipText = () => {
    return (
      <TooltipWrapper>
        <div>{t('Unassigned')}</div>
        <TooltipSubtext>
          {tct('You can auto-assign issues by adding [issueOwners:Issue Owner rules].', {
            issueOwners: (
              <TooltipSubExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
            ),
          })}
        </TooltipSubtext>
      </TooltipWrapper>
    );
  };

  return assignedTo ? (
    <Tooltip title={makeAssignedTooltipText(assignedTo)}>
      <StyledTag icon={makeAssignedIcon(assignedTo)} />
    </Tooltip>
  ) : (
    <Tooltip title={makeUnAssignedTooltipText()}>
      <StyledTag icon={makeUnassignedIcon()} borderStyle="dashed" />
    </Tooltip>
  );
}

// const StyledIconUser = styled(IconUser)`
//   /* We need this to center with Avatar */
//   margin-right: 2px;
// `;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const StyledTag = styled(Tag)`
  span {
    display: flex;
    align-items: center;
    gap: ${space(0.25)};
  }
  & > div {
    height: 24px;
    padding: ${space(0.5)};
  }
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
