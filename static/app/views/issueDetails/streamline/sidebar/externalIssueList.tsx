import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, type ButtonProps, LinkButton} from 'sentry/components/button';
import AlertLink from 'sentry/components/core/alertLink';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {ExternalIssueAction} from 'sentry/components/group/externalIssuesList/hooks/types';
import useGroupExternalIssues from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

function getActionLabelAndTextValue({
  action,
  integrationDisplayName,
}: {
  action: ExternalIssueAction;
  integrationDisplayName: string;
}): {label: string | JSX.Element; textValue: string} {
  // If there's no subtext or subtext matches name, just show name
  if (!action.nameSubText || action.nameSubText === action.name) {
    return {
      label: action.name,
      textValue: action.name,
    };
  }

  // If action name matches integration name, just show subtext
  if (action.name === integrationDisplayName) {
    return {
      label: action.nameSubText,
      textValue: `${action.name} ${action.nameSubText}`,
    };
  }

  // Otherwise show both name and subtext
  return {
    label: (
      <div>
        <strong>{action.name}</strong>
        <div>{action.nameSubText}</div>
      </div>
    ),
    textValue: `${action.name} ${action.nameSubText}`,
  };
}

interface ExternalIssueListProps {
  event: Event;
  group: Group;
  project: Project;
}

export function ExternalIssueList({group, event, project}: ExternalIssueListProps) {
  const organization = useOrganization();
  const {isLoading, integrations, linkedIssues} = useGroupExternalIssues({
    group,
    event,
    project,
  });

  const hasLinkedIssuesOrIntegrations = integrations.length || linkedIssues.length;

  return (
    <SidebarFoldSection
      data-test-id="linked-issues"
      title={<Title>{t('Issue Tracking')}</Title>}
      sectionKey={SectionKey.EXTERNAL_ISSUES}
    >
      {isLoading ? (
        <Placeholder height="25px" testId="issue-tracking-loading" />
      ) : hasLinkedIssuesOrIntegrations ? (
        <Fragment>
          {linkedIssues.length > 0 && (
            <IssueActionWrapper>
              {linkedIssues.map(linkedIssue => (
                <ErrorBoundary key={linkedIssue.key} mini>
                  <Tooltip
                    overlayStyle={{maxWidth: '400px'}}
                    position="bottom"
                    title={
                      <LinkedIssueTooltipWrapper>
                        <LinkedIssueName>{linkedIssue.title}</LinkedIssueName>
                        <HorizontalSeparator />
                        <UnlinkButton
                          priority="link"
                          size="zero"
                          onClick={linkedIssue.onUnlink}
                        >
                          {t('Unlink issue')}
                        </UnlinkButton>
                      </LinkedIssueTooltipWrapper>
                    }
                    isHoverable
                  >
                    <LinkedIssue
                      href={linkedIssue.url}
                      external
                      size="zero"
                      icon={linkedIssue.displayIcon}
                    >
                      <IssueActionName>{linkedIssue.displayName}</IssueActionName>
                    </LinkedIssue>
                  </Tooltip>
                </ErrorBoundary>
              ))}
            </IssueActionWrapper>
          )}
          {integrations.length > 0 && (
            <IssueActionWrapper>
              {integrations.map(integration => {
                const sharedButtonProps: ButtonProps = {
                  size: 'zero',
                  icon: integration.displayIcon,
                  children: <IssueActionName>{integration.displayName}</IssueActionName>,
                };

                if (integration.actions.length === 1) {
                  const action = integration.actions[0]!;
                  return (
                    <ErrorBoundary key={integration.key} mini>
                      {action.href ? (
                        // Exclusively used for group.pluginActions
                        <IssueActionLinkButton
                          size="zero"
                          icon={integration.displayIcon}
                          disabled={integration.disabled}
                          title={
                            integration.disabled ? integration.disabledText : undefined
                          }
                          onClick={action.onClick}
                          href={action.href}
                          external
                        >
                          <IssueActionName>{integration.displayName}</IssueActionName>
                        </IssueActionLinkButton>
                      ) : (
                        <IssueActionButton
                          {...sharedButtonProps}
                          disabled={integration.disabled}
                          title={
                            integration.disabled ? integration.disabledText : undefined
                          }
                          onClick={action.onClick}
                        />
                      )}
                    </ErrorBoundary>
                  );
                }

                return (
                  <ErrorBoundary key={integration.key} mini>
                    <DropdownMenu
                      trigger={triggerProps => (
                        <IssueActionDropdownMenu
                          {...sharedButtonProps}
                          {...triggerProps}
                          showChevron={false}
                        />
                      )}
                      items={integration.actions.map(action => ({
                        key: action.id,
                        ...getActionLabelAndTextValue({
                          action,
                          integrationDisplayName: integration.displayName,
                        }),
                        onAction: action.onClick,
                        disabled: integration.disabled,
                      }))}
                    />
                  </ErrorBoundary>
                );
              })}
            </IssueActionWrapper>
          )}
        </Fragment>
      ) : (
        <AlertLink
          priority="muted"
          size="small"
          to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
          withoutMarginBottom
        >
          {t('Track this issue in Jira, GitHub, etc.')}
        </AlertLink>
      )}
    </SidebarFoldSection>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IssueActionWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  line-height: 1.2;
  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const LinkedIssue = styled(LinkButton)`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(0.75)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: normal;
`;

const IssueActionButton = styled(Button)`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(0.75)};
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: normal;
`;

const IssueActionLinkButton = styled(LinkButton)`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(0.75)};
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: normal;
`;

const IssueActionDropdownMenu = styled(DropdownButton)`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(0.75)};
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: normal;

  &[aria-expanded='true'] {
    border: 1px solid ${p => p.theme.border};
  }
`;

const IssueActionName = styled('div')`
  ${p => p.theme.overflowEllipsis}
  max-width: 200px;
`;

const LinkedIssueTooltipWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  white-space: nowrap;
`;

const LinkedIssueName = styled('div')`
  ${p => p.theme.overflowEllipsis}
  margin-right: ${space(0.25)};
`;

const HorizontalSeparator = styled('div')`
  width: 1px;
  height: 14px;
  background: ${p => p.theme.border};
`;

const UnlinkButton = styled(Button)`
  color: ${p => p.theme.subText};
`;
