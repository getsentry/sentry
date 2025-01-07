import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import SuggestedAvatarStack from 'sentry/components/avatar/suggestedAvatarStack';
import {Chevron} from 'sentry/components/chevron';
import type {
  DeprecatedAssigneeSelectorDropdownProps,
  SuggestedAssignee,
} from 'sentry/components/deprecatedAssigneeSelectorDropdown';
import {DeprecatedAssigneeSelectorDropdown} from 'sentry/components/deprecatedAssigneeSelectorDropdown';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconUser} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {SuggestedOwnerReason} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';

interface DeprecatedAssigneeSelectorProps
  extends Omit<
    DeprecatedAssigneeSelectorDropdownProps,
    'children' | 'organization' | 'assignedTo'
  > {
  noDropdown?: boolean;
}

export function AssigneeAvatar({
  assignedTo,
  suggestedActors = [],
}: {
  assignedTo?: Actor | null;
  suggestedActors?: SuggestedAssignee[];
}) {
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
  const assignedToSuggestion = suggestedActors.find(actor => actor.id === assignedTo?.id);

  if (assignedTo) {
    return (
      <ActorAvatar
        actor={assignedTo}
        className="avatar"
        size={24}
        tooltip={
          <TooltipWrapper>
            {tct('Assigned to [name]', {
              name: assignedTo.type === 'team' ? `#${assignedTo.name}` : assignedTo.name,
            })}
            {assignedToSuggestion &&
              suggestedReasons[assignedToSuggestion.suggestedReason] && (
                <TooltipSubtext>
                  {suggestedReasons[assignedToSuggestion.suggestedReason]}
                </TooltipSubtext>
              )}
          </TooltipWrapper>
        }
      />
    );
  }

  if (suggestedActors.length > 0) {
    const firstActor = suggestedActors[0]!;
    return (
      <SuggestedAvatarStack
        size={26}
        owners={suggestedActors}
        tooltipOptions={{isHoverable: true}}
        tooltip={
          <TooltipWrapper>
            <div>
              {tct('Suggestion: [name]', {
                name:
                  firstActor.type === 'team' ? `#${firstActor.name}` : firstActor.name,
              })}
              {suggestedActors.length > 1 &&
                tn(' + %s other', ' + %s others', suggestedActors.length - 1)}
            </div>
            <TooltipSubtext>
              {suggestedReasons[firstActor.suggestedReason]}
            </TooltipSubtext>
          </TooltipWrapper>
        }
      />
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

/**
 * @deprecated use AssigneeSelectorDropdown instead (Coming in future PR)
 */
function DeprecatedAssigneeSelector({
  noDropdown,
  ...props
}: DeprecatedAssigneeSelectorProps) {
  const organization = useOrganization();
  const groups = useLegacyStore(GroupStore);
  const group = groups.find(item => item.id === props.id);

  return (
    <AssigneeWrapper>
      <DeprecatedAssigneeSelectorDropdown
        organization={organization}
        assignedTo={group?.assignedTo}
        {...props}
      >
        {({loading, isOpen, getActorProps, suggestedAssignees}) => {
          const avatarElement = (
            <AssigneeAvatar
              assignedTo={group?.assignedTo}
              suggestedActors={suggestedAssignees}
            />
          );

          return (
            <Fragment>
              {loading && (
                <LoadingIndicator
                  mini
                  style={{height: '24px', margin: 0, marginRight: 11}}
                />
              )}
              {!loading && !noDropdown && (
                <DropdownButton data-test-id="assignee-selector" {...getActorProps({})}>
                  {avatarElement}
                  <Chevron direction={isOpen ? 'up' : 'down'} size="small" />
                </DropdownButton>
              )}
              {!loading && noDropdown && avatarElement}
            </Fragment>
          );
        }}
      </DeprecatedAssigneeSelectorDropdown>
    </AssigneeWrapper>
  );
}

export default DeprecatedAssigneeSelector;

const AssigneeWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;

  /* manually align menu underneath dropdown caret */
`;

const StyledIconUser = styled(IconUser)`
  /* We need this to center with Avatar */
  margin-right: 2px;
`;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  font-size: 20px;
  gap: ${space(0.5)};
`;

const TooltipWrapper = styled('div')`
  text-align: left;
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
