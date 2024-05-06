// import {Fragment} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Tag from 'sentry/components/badge/tag';
import {Chevron} from 'sentry/components/chevron';
import Placeholder from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
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

  const makeAssignedIcon = (actor: Actor) => {
    return (
      <Fragment>
        <ActorAvatar
          actor={actor}
          className="avatar"
          size={16}
          tooltip={
            <TooltipWrapper>
              {tct('Assigned to [name]', {
                name: actor.type === 'team' ? `#${actor.name}` : actor.name,
              })}
              {assignmentReason && <TooltipSubtext>{assignmentReason}</TooltipSubtext>}
            </TooltipWrapper>
          }
        />
        {showLabel && <Fragment>{actor.name}</Fragment>}
        <Chevron direction="down" size="small" />
      </Fragment>
    );
  };

  const makeUnassignedIcon = () => {
    return (
      <Fragment>
        <Placeholder shape="circle" width={'16px'} height={'16px'} />
        {showLabel && <Fragment>Unassigned</Fragment>}
        <Chevron direction="down" size="small" />
      </Fragment>
    );
  };

  return assignedTo ? (
    <StyledTag icon={makeAssignedIcon(assignedTo)} />
  ) : (
    <StyledTag icon={makeUnassignedIcon()} borderStyle="dashed" />
  );
}

// const StyledIconUser = styled(IconUser)`
//   /* We need this to center with Avatar */
//   margin-right: 2px;
// `;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

// const TooltipSubExternalLink = styled(ExternalLink)`
//   color: ${p => p.theme.subText};
//   text-decoration: underline;

//   :hover {
//     color: ${p => p.theme.subText};
//   }
// `;

const StyledTag = styled(Tag)`
  span {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
  }
`;

const TooltipSubtext = styled('div')`
  color: ${p => p.theme.subText};
`;

// const PillOutline = styled('div')<{assigneeExists: boolean}>`
//   display: inline-flex;
//   padding: 2px 4px 4px 4px;
//   border: 1px ${p => (p.assigneeExists ? 'solid' : 'dashed')} ${p => p.theme.border};
//   border-radius: 16px;
//   align-items: center;
//   align-self: flex-start;
// `;
