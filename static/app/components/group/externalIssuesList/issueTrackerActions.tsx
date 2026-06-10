import styled from '@emotion/styled';

import {Button, LinkButton, type ButtonProps} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {DropdownButton} from 'sentry/components/dropdownButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {
  ExternalIssueAction,
  ExternalIssueIntegration,
} from 'sentry/components/group/externalIssuesList/hooks/types';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

const ISSUE_TRACKER_MENU_MAX_HEIGHT = 300;

interface InlineIssueTrackerActionsProps {
  integrations: ExternalIssueIntegration[];
}

interface IssueTrackerActionDropdownProps {
  integrations: ExternalIssueIntegration[];
  isLoading?: boolean;
}

interface IssueTrackerActionMenuLabel {
  label: React.ReactNode;
  textValue: string;
  details?: React.ReactNode;
}

function getIssueTrackerActionMenuLabel({
  action,
  integrationDisplayName,
}: {
  action: ExternalIssueAction;
  integrationDisplayName: string;
}): IssueTrackerActionMenuLabel {
  // If there's no subtext or subtext matches name, just show name
  if (!action.nameSubText || action.nameSubText === action.name) {
    return {
      label: (
        <Text as="span" bold>
          {action.name}
        </Text>
      ),
      textValue: action.name,
    };
  }

  // If action name matches integration name, just show subtext
  if (action.name === integrationDisplayName) {
    return {
      label: (
        <Text as="span" bold>
          {action.nameSubText}
        </Text>
      ),
      textValue: `${action.name} ${action.nameSubText}`,
    };
  }

  // Otherwise show both name and subtext
  return {
    label: (
      <Text as="span" bold>
        {action.name}
      </Text>
    ),
    details: (
      <Text as="span" variant="muted">
        {action.nameSubText}
      </Text>
    ),
    textValue: `${action.name} ${action.nameSubText}`,
  };
}

function getIssueTrackerActionAvailability(
  integration: ExternalIssueIntegration,
  action: ExternalIssueAction
) {
  const isDisabled = Boolean(integration.disabled || action.disabled);
  const tooltipTitle = isDisabled
    ? (integration.disabledText ?? action.disabledText)
    : undefined;

  return {isDisabled, tooltipTitle};
}

export function InlineIssueTrackerActions({
  integrations,
}: InlineIssueTrackerActionsProps) {
  const organization = useOrganization();

  return (
    <IssueActionWrapper>
      {integrations.map(integration => {
        const sharedButtonProps: ButtonProps = {
          size: 'zero',
          icon: integration.displayIcon ? (
            <IssueTrackerIcon>{integration.displayIcon}</IssueTrackerIcon>
          ) : undefined,
          variant: 'transparent',
          children: <IssueActionName>{integration.displayName}</IssueActionName>,
        };

        if (integration.actions.length === 1) {
          const action = integration.actions[0]!;
          const {isDisabled, tooltipTitle} = getIssueTrackerActionAvailability(
            integration,
            action
          );
          const onAction = () => {
            action.onClick();
            trackAnalytics('feedback.details-integration-issue-clicked', {
              organization,
              integration_key: integration.key,
            });
          };

          return (
            <ErrorBoundary key={integration.key} mini>
              {action.href ? (
                // Exclusively used for group.pluginActions
                <IssueActionLinkButton
                  size="zero"
                  icon={
                    integration.displayIcon ? (
                      <IssueTrackerIcon>{integration.displayIcon}</IssueTrackerIcon>
                    ) : undefined
                  }
                  disabled={isDisabled}
                  tooltipProps={{title: tooltipTitle}}
                  onClick={onAction}
                  href={action.href}
                  external
                >
                  <IssueActionName>{integration.displayName}</IssueActionName>
                </IssueActionLinkButton>
              ) : (
                <IssueActionButton
                  {...sharedButtonProps}
                  disabled={isDisabled}
                  tooltipProps={{title: tooltipTitle}}
                  onClick={onAction}
                />
              )}
            </ErrorBoundary>
          );
        }

        return (
          <ErrorBoundary key={integration.key} mini>
            <DropdownMenu
              maxMenuHeight={ISSUE_TRACKER_MENU_MAX_HEIGHT}
              trigger={triggerProps => (
                <IssueActionDropdownMenu
                  {...sharedButtonProps}
                  {...triggerProps}
                  showChevron={false}
                />
              )}
              items={integration.actions.map(action => {
                const {isDisabled, tooltipTitle} = getIssueTrackerActionAvailability(
                  integration,
                  action
                );
                const {details, label, textValue} = getIssueTrackerActionMenuLabel({
                  action,
                  integrationDisplayName: integration.displayName,
                });

                return {
                  key: action.id,
                  label,
                  textValue,
                  details: isDisabled ? tooltipTitle : details,
                  onAction: () => {
                    action.onClick();
                    trackAnalytics('feedback.details-integration-issue-clicked', {
                      organization,
                      integration_key: integration.key,
                    });
                  },
                  disabled: isDisabled,
                };
              })}
            />
          </ErrorBoundary>
        );
      })}
    </IssueActionWrapper>
  );
}

export function IssueTrackerActionDropdown({
  integrations,
  isLoading,
}: IssueTrackerActionDropdownProps) {
  const organization = useOrganization();
  const issueTrackerActionLabel = t('Link issue');

  if (isLoading || integrations.length === 0) {
    return null;
  }

  const issueTrackerActionGroups = integrations.map(integration => ({
    integration,
    actions: integration.actions.map(action => {
      const {details, label, textValue} =
        integration.actions.length === 1
          ? {
              label: (
                <Text as="span" bold>
                  {integration.displayName}
                </Text>
              ),
              textValue: integration.displayName,
            }
          : getIssueTrackerActionMenuLabel({
              action,
              integrationDisplayName: integration.displayName,
            });
      const {isDisabled, tooltipTitle} = getIssueTrackerActionAvailability(
        integration,
        action
      );
      const onAction = () => {
        action.onClick();
        trackAnalytics('feedback.details-integration-issue-clicked', {
          organization,
          integration_key: integration.key,
        });
      };

      return {
        action,
        details:
          integration.actions.length === 1 && action.nameSubText ? (
            <Text as="span" variant="muted">
              {action.nameSubText}
            </Text>
          ) : (
            details
          ),
        integration,
        isDisabled,
        label,
        onAction,
        textValue,
        tooltipTitle,
      };
    }),
  }));
  const issueTrackerActions = issueTrackerActionGroups.flatMap(group => group.actions);

  if (issueTrackerActions.length === 1) {
    const {action, isDisabled, onAction, tooltipTitle} = issueTrackerActions[0]!;

    if (action.href) {
      return (
        <LinkButton
          disabled={isDisabled}
          external
          href={action.href}
          icon={<HeaderIssueTrackerIcon />}
          onClick={onAction}
          size="zero"
          tooltipProps={{title: tooltipTitle}}
          variant="transparent"
        >
          {issueTrackerActionLabel}
        </LinkButton>
      );
    }

    return (
      <Button
        disabled={isDisabled}
        icon={<HeaderIssueTrackerIcon />}
        onClick={onAction}
        size="zero"
        tooltipProps={{title: tooltipTitle}}
        variant="transparent"
      >
        {issueTrackerActionLabel}
      </Button>
    );
  }

  return (
    <DropdownMenu
      maxMenuHeight={ISSUE_TRACKER_MENU_MAX_HEIGHT}
      trigger={(triggerProps, isOpen) => (
        <DropdownButton
          {...triggerProps}
          isOpen={isOpen}
          icon={<HeaderIssueTrackerIcon />}
          showChevron={false}
          size="zero"
          variant="transparent"
        >
          {issueTrackerActionLabel}
        </DropdownButton>
      )}
      items={issueTrackerActionGroups.map<MenuItemProps>(({integration, actions}) => ({
        key: integration.key,
        children: actions.map(
          ({action, details, isDisabled, label, onAction, textValue, tooltipTitle}) => ({
            key: `${integration.key}-${action.id}`,
            label,
            textValue,
            details: isDisabled ? tooltipTitle : details,
            leadingItems: (
              <IssueTrackerIcon style={{transform: 'translateY(3px)'}}>
                {integration.displayIcon}
              </IssueTrackerIcon>
            ),
            externalHref: action.href,
            disabled: isDisabled,
            onAction,
          })
        ),
      }))}
    />
  );
}

const IssueActionWrapper = styled('span')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
  line-height: 1.2;
`;

const IssueActionButton = styled(Button)`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  font-weight: normal;
`;

const IssueActionLinkButton = styled(LinkButton)`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  font-weight: normal;
`;

const IssueActionDropdownMenu = styled(DropdownButton)`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  font-weight: normal;

  &[aria-expanded='true'] {
    border: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const HeaderIssueTrackerIcon = styled(IconAdd)`
  transform: translateY(0);
`;

const IssueTrackerIcon = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
`;

const IssueActionName = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;
