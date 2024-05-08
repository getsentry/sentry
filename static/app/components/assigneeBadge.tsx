// import {Fragment} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
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

type AssigneeBadgeProps = {
  chevronDirection: 'up' | 'down';
  assignedTo?: Actor | undefined;
  assignmentReason?: string;
  showLabel?: boolean;
};

const AVATAR_SIZE = 16;

export function AssigneeBadge({
  assignedTo,
  assignmentReason,
  showLabel = false,
  chevronDirection = 'down',
}: AssigneeBadgeProps) {
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
        <Chevron direction={chevronDirection} size="small" />
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
        <Chevron direction={chevronDirection} size="small" />
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
      <StyledTag
        data-is-team={assignedTo.type === 'team'}
        // Team avatars need extra left padding since the square avatar
        // is being fit into a rounded edge
        css={css`
          --avatar-spacing: ${space(0.5)} ${space(0.25)} ${space(0.5)}
            ${assignedTo.type === 'team' ? space(0.75) : space(0.5)};
        `}
        icon={makeAssignedIcon(assignedTo)}
      />
    </Tooltip>
  ) : (
    <Tooltip title={makeUnAssignedTooltipText()}>
      <StyledTag icon={makeUnassignedIcon()} borderStyle="dashed" />
    </Tooltip>
  );
}

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const StyledTag = styled(Tag)`
  span {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
  }
  & > div {
    height: 24px;
    padding: var(--avatar-spacing, ${space(0.5)});
  }
  cursor: pointer;
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
