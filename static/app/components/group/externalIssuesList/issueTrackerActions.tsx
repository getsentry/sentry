import styled from '@emotion/styled';

import {Button, ButtonBar, type ButtonProps} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {DropdownButton} from 'sentry/components/dropdownButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {
  ExternalIssueAction,
  ExternalIssueIntegration,
} from 'sentry/components/group/externalIssuesList/hooks/types';
import {IconAdd, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Theme} from 'sentry/utils/theme';
import {useOrganization} from 'sentry/utils/useOrganization';

const ISSUE_TRACKER_MENU_MAX_HEIGHT = 300;

interface InlineIssueTrackerActionsProps {
  integrations: ExternalIssueIntegration[];
}

interface IssueTrackerActionDropdownProps {
  integrations: ExternalIssueIntegration[];
  fullWidth?: boolean;
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
              <IssueActionButton
                {...sharedButtonProps}
                disabled={isDisabled}
                tooltipProps={{title: tooltipTitle}}
                onClick={onAction}
              />
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
  fullWidth,
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

  const menuItems: MenuItemProps[] = [
    ...issueTrackerActionGroups.map<MenuItemProps>(({integration, actions}) => ({
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
          disabled: isDisabled,
          onAction,
        })
      ),
    })),
    {
      key: 'custom-integration',
      children: [
        {
          key: 'create-custom-integration',
          label: (
            <Text as="span" bold>
              {t('Add your own tracker…')}
            </Text>
          ),
          textValue: t('Add your own tracker'),
          leadingItems: (
            <IssueTrackerIcon style={{transform: 'translateY(3px)'}}>
              <IconAdd size="sm" />
            </IssueTrackerIcon>
          ),
          to: `/settings/${organization.slug}/developer-settings/new-internal/?referrer=link_issue_menu`,
          onAction: () =>
            trackAnalytics('integrations.link_issue_menu_custom_integration_clicked', {
              organization,
              view: 'issue_details',
            }),
        },
      ],
    },
  ];

  if (issueTrackerActions.length === 1) {
    const {isDisabled, onAction, tooltipTitle} = issueTrackerActions[0]!;

    const BarComponent = fullWidth ? FullWidthSplitButtonBar : ButtonBar;
    const ButtonComponent = fullWidth ? FullWidthButton : Button;
    const ChevronComponent = fullWidth ? FullWidthSplitChevron : Button;

    return (
      <BarComponent columns={fullWidth ? '1fr auto' : undefined}>
        <ButtonComponent
          disabled={isDisabled}
          icon={<HeaderIssueTrackerIcon />}
          onClick={onAction}
          size="zero"
          tooltipProps={{title: tooltipTitle}}
          variant="transparent"
        >
          {issueTrackerActionLabel}
        </ButtonComponent>
        <DropdownMenu
          maxMenuHeight={ISSUE_TRACKER_MENU_MAX_HEIGHT}
          trigger={(triggerProps, isOpen) => (
            <ChevronComponent
              {...triggerProps}
              aria-label={t('More link options')}
              icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
              size="zero"
              variant="transparent"
            />
          )}
          items={menuItems}
        />
      </BarComponent>
    );
  }

  return (
    <DropdownMenu
      maxMenuHeight={ISSUE_TRACKER_MENU_MAX_HEIGHT}
      trigger={(triggerProps, isOpen) => {
        const DropdownButtonComponent = fullWidth
          ? FullWidthDropdownButton
          : DropdownButton;

        return (
          <DropdownButtonComponent
            {...triggerProps}
            isOpen={isOpen}
            icon={<HeaderIssueTrackerIcon />}
            showChevron={false}
            size="zero"
            variant="transparent"
          >
            {issueTrackerActionLabel}
          </DropdownButtonComponent>
        );
      }}
      items={menuItems}
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

const fullWidthButtonStyles = (p: {theme: Theme}) => `
  width: 100%;
  min-height: 34px;
  border: 1px dashed ${p.theme.tokens.border.primary};
  border-radius: ${p.theme.radius.md};
  font-size: ${p.theme.font.size.md};
`;

const FullWidthButton = styled(Button)`
  ${fullWidthButtonStyles}
`;

const FullWidthDropdownButton = styled(DropdownButton)`
  ${fullWidthButtonStyles}
`;

const FullWidthSplitButtonBar = styled(ButtonBar)`
  width: 100%;
`;

const FullWidthSplitChevron = styled(Button)`
  min-height: 34px;
  padding: 0 ${p => p.theme.space.sm};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
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
