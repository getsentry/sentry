import {Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompositeSelect} from 'sentry/components/core/compactSelect/composite';
import {SelectContext} from 'sentry/components/core/compactSelect/control';
import {Flex} from 'sentry/components/core/layout';
import {MenuListItem, type MenuListItemProps} from 'sentry/components/core/menuListItem';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {
  ExternalIssueAction,
  ExternalIssueIntegration,
} from 'sentry/components/group/externalIssuesList/hooks/types';
import useGroupExternalIssues from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

function getActionLabelAndTextValue({
  action,
  integrationDisplayName,
}: {
  action: ExternalIssueAction;
  integrationDisplayName: string;
}): {
  label: string | React.JSX.Element;
  textValue: string;
  details?: string | React.JSX.Element;
} {
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
    label: action.name,
    details: action.nameSubText,
    textValue: `${action.name} ${action.nameSubText}`,
  };
}

interface ExternalIssueListProps {
  event: Event;
  group: Group;
  project: Project;
}

export function StreamlinedExternalIssueList({
  group,
  event,
  project,
}: ExternalIssueListProps) {
  const {isLoading, integrations, linkedIssues} = useGroupExternalIssues({
    group,
    event,
    project,
  });

  if (isLoading) {
    return <Placeholder height="25px" testId="issue-tracking-loading" />;
  }

  return (
    <Flex direction="row" wrap="wrap" gap={space(1)} flex={1}>
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
                <LinkButton
                  href={linkedIssue.url}
                  external
                  size="zero"
                  icon={linkedIssue.displayIcon}
                >
                  <IssueActionName>{linkedIssue.displayName}</IssueActionName>
                </LinkButton>
              </Tooltip>
            </ErrorBoundary>
          ))}
        </IssueActionWrapper>
      )}
      <ExternalIssueMenu linkedIssues={linkedIssues} integrations={integrations} />
    </Flex>
  );
}

function ExternalIssueMenu(props: ReturnType<typeof useGroupExternalIssues>) {
  const organization = useOrganization({allowNull: false});

  return (
    <Fragment>
      <CompositeSelect
        trigger={triggerProps => (
          <Button {...triggerProps} size="zero" icon={<IconAdd />}>
            {props.linkedIssues.length === 0 ? t('Add Linked Issue') : null}
          </Button>
        )}
        // Required for submenu interactions
        isDismissable={false}
        menuTitle={t('Add Linked Issue')}
        hideOptions={props.integrations.length === 0}
        menuBody={props.integrations.length === 0 && <ExternalIssueMenuEmpty />}
        menuFooter={props.integrations.length > 0 && <ExternalIssueManageLink />}
      >
        <CompositeSelect.Region
          closeOnSelect={({value}) => {
            const integration = props.integrations.find(({key}) => key === value);
            if (!integration) {
              return true;
            }
            return integration.actions.length === 1;
          }}
          onChange={({value}) => {
            const integration = props.integrations.find(({key}) => key === value);
            if (!integration) {
              return;
            }
            if (integration.actions.length === 1) {
              const action = integration.actions[0]!;
              action.onClick();
              trackAnalytics('feedback.details-integration-issue-clicked', {
                organization,
                integration_key: integration.key,
              });
              return;
            }
          }}
          options={props.integrations.map(integration => ({
            key: integration.key,
            disabled: integration.disabled,
            leadingItems: (
              <Flex align="center" justify="center" style={{minHeight: 19}}>
                {integration.displayIcon}
              </Flex>
            ),
            tooltip: integration.disabled ? integration.disabledText : undefined,
            label: integration.displayName,
            hideCheck: true,
            value: integration.key,
            textValue: integration.key,
            details:
              integration.actions.length > 1 ? (
                <ExternalIssueSubmenu integration={integration} />
              ) : undefined,
            showDetailsInOverlay: true,
          }))}
        />
      </CompositeSelect>
    </Fragment>
  );
}

function ExternalIssueSubmenu(props: {integration: ExternalIssueIntegration}) {
  const {integration} = props;
  const {overlayState} = useContext(SelectContext);
  return integration.actions.map(action => {
    const itemProps: MenuListItemProps = {
      tooltip: action.disabled ? action.disabledText : undefined,
      disabled: action.disabled,
      ...getActionLabelAndTextValue({
        action,
        integrationDisplayName: integration.displayName,
      }),
    };
    const callbackProps: Record<string, () => void> = {
      onPointerDown: () => {
        overlayState?.close();
        action.onClick();
      },
    };
    return <MenuListItem key={action.id} {...callbackProps} {...itemProps} />;
  });
}

function ExternalIssueMenuEmpty() {
  return (
    <Flex
      style={{padding: space(3)}}
      direction="column"
      align="center"
      justify="center"
      gap={space(2)}
    >
      <EmptyStateText>{t('No issue linking integration installed')}</EmptyStateText>
      <ExternalIssueManageLink size="sm" priority="primary" />
    </Flex>
  );
}

function ExternalIssueManageLink(props: Pick<ButtonProps, 'size' | 'priority'>) {
  const organization = useOrganization({allowNull: false});

  return (
    <LinkButton
      size="zero"
      priority="default"
      {...props}
      to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
    >
      {t('Manage Integrations')}
    </LinkButton>
  );
}

const EmptyStateText = styled('span')`
  text-align: center;
  color: ${p => p.theme.tokens.content.muted};
`;

const IssueActionWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  line-height: 1.2;
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
