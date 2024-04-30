import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Chevron} from 'sentry/components/chevron';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Actor} from 'sentry/types';

export function AssigneeBadge({
  assignedTo,
  assignmentReason,
  showName = false,
}: {
  assignedTo?: Actor | null;
  assignmentReason?: string;
  showName?: boolean;
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

  if (assignedTo) {
    return (
      <PillOutline assigneeExists={!!assignedTo}>
        <ActorAvatar
          actor={assignedTo}
          className="avatar"
          size={16}
          tooltip={
            <TooltipWrapper>
              {tct('Assigned to [name]', {
                name:
                  assignedTo.type === 'team' ? `#${assignedTo.name}` : assignedTo.name,
              })}
              {assignmentReason && <TooltipSubtext>{assignmentReason}</TooltipSubtext>}
            </TooltipWrapper>
          }
        />
        {assignedTo && showName && <Fragment>{assignedTo.name}</Fragment>}
        <Chevron direction="down" size="small" />
      </PillOutline>
    );
  }

  return (
    <Tooltip
      isHoverable
      skipWrapper
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
      <StyledIconUser data-test-id="unassigned" size="md" color="gray400" />
    </Tooltip>
  );
}

const StyledIconUser = styled(IconUser)`
  /* We need this to center with Avatar */
  margin-right: 2px;
`;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.subText};
  text-decoration: underline;

  :hover {
    color: ${p => p.theme.subText};
  }
`;

const TooltipSubtext = styled('div')`
  color: ${p => p.theme.subText};
`;

const PillOutline = styled('div')<{assigneeExists: boolean}>`
  display: inline-flex;
  padding: 2px 4px 4px 4px;
  border: 1px ${p => (p.assigneeExists ? 'solid' : 'dotted')} ${p => p.theme.border};
  border-radius: 16px;
  align-items: center;
  align-self: flex-start;
`;
