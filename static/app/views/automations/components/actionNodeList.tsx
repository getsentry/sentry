import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Select} from '@sentry/scraps/select';

import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  ActionGroup,
  ActionType,
  type Action,
  type ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ActionNodeContext,
  actionNodesMap,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {AutomationBuilderRow} from 'sentry/views/automations/components/automationBuilderRow';
import {useAvailableActionsQuery} from 'sentry/views/automations/hooks';
import {useConnectedDetectors} from 'sentry/views/automations/hooks/useConnectedDetectors';
import {getIncompatibleActionWarning} from 'sentry/views/automations/utils/getIncompatibleActionWarning';

interface ActionNodeListProps {
  actions: Action[];
  conditionGroupId: string;
  onAddRow: (actionHandler: ActionHandler) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateAction: (id: string, params: Record<string, any>) => void;
}

interface Option {
  label: string;
  value: ActionHandler;
}

function MenuListWithFooter(props: any) {
  const orgSlug = props.selectProps?.orgSlug;
  return (
    <selectComponents.MenuList {...props}>
      {props.children}
      <AddIntegrationFooter>
        <LinkButton
          size="xs"
          priority="default"
          icon={<IconAdd />}
          href={`/settings/${orgSlug}/integrations/`}
          external
        >
          {t('Add another integration')}
        </LinkButton>
      </AddIntegrationFooter>
    </selectComponents.MenuList>
  );
}

const MENU_COMPONENTS = {MenuList: MenuListWithFooter};

function getActionHandler(
  action: Action,
  availableActions: ActionHandler[]
): ActionHandler | undefined {
  if (action.type === ActionType.SENTRY_APP) {
    return availableActions.find(handler => {
      if (handler.type !== ActionType.SENTRY_APP) {
        return false;
      }
      const {targetIdentifier} = action.config;
      const sentryApp = handler.sentryApp;

      return targetIdentifier === sentryApp?.id;
    });
  }
  return availableActions.find(handler => handler.type === action.type);
}

export function ActionNodeList({
  conditionGroupId,
  placeholder,
  actions,
  onAddRow,
  onDeleteRow,
  updateAction,
}: ActionNodeListProps) {
  const {slug: orgSlug} = useOrganization();
  const {data: availableActions = [], isLoading: isLoadingActions} =
    useAvailableActionsQuery();
  const {errors, removeError} = useAutomationBuilderErrorContext();
  const {connectedDetectors} = useConnectedDetectors();

  const options = useMemo(() => {
    const notificationActions: Option[] = [];
    const ticketCreationActions: Option[] = [];
    const otherActions: Option[] = [];

    availableActions.forEach(action => {
      const label =
        actionNodesMap.get(action.type)?.label || action.sentryApp?.name || action.type;
      const newAction = {
        value: action,
        label,
      };

      if (action.handlerGroup === ActionGroup.NOTIFICATION) {
        notificationActions.push(newAction);
      } else if (action.handlerGroup === ActionGroup.TICKET_CREATION) {
        ticketCreationActions.push(newAction);
      } else {
        otherActions.push(newAction);
      }
    });

    return [
      {
        key: ActionGroup.NOTIFICATION,
        label: t('Notifications'),
        options: notificationActions,
      },
      {
        key: ActionGroup.TICKET_CREATION,
        label: t('Ticket Creation'),
        options: ticketCreationActions,
      },
      {
        key: ActionGroup.OTHER,
        label: t('Other Integrations'),
        options: otherActions,
      },
    ];
  }, [availableActions]);

  return (
    <Fragment>
      {actions.map(action => {
        if (isLoadingActions) {
          return null;
        }
        const handler = getActionHandler(action, availableActions);
        if (!handler) {
          const actionLabel = actionNodesMap.get(action.type)?.label;
          return (
            <AutomationBuilderRow
              key={`actionFilters.${conditionGroupId}.action.${action.id}`}
              onDelete={() => {
                onDeleteRow(action.id);
              }}
              hasError
              errorMessage={
                actionLabel
                  ? t(
                      'The %s action is no longer available. Please remove and reconfigure this action.',
                      actionLabel
                    )
                  : t(
                      'The integration is no longer available. Please remove and reconfigure this action.'
                    )
              }
            >
              {actionLabel ?? t('Unknown integration')}
            </AutomationBuilderRow>
          );
        }
        const error = errors?.[action.id];
        const warningMessage = getIncompatibleActionWarning(action, {
          connectedDetectors,
        });
        return (
          <AutomationBuilderRow
            key={`actionFilters.${conditionGroupId}.action.${action.id}`}
            onDelete={() => {
              onDeleteRow(action.id);
            }}
            hasError={!!error}
            errorMessage={error}
            warningMessage={warningMessage}
          >
            <ActionNodeContext.Provider
              value={{
                action,
                actionId: `actionFilters.${conditionGroupId}.action.${action.id}`,
                onUpdate: newAction => updateAction(action.id, newAction),
                handler,
              }}
            >
              <Node />
            </ActionNodeContext.Provider>
          </AutomationBuilderRow>
        );
      })}
      <StyledSelectControl
        aria-label={t('Add action')}
        options={options}
        onChange={(obj: any) => {
          onAddRow(obj.value);
          removeError(conditionGroupId);
        }}
        placeholder={placeholder}
        value={null}
        // @ts-expect-error custom prop accessed via selectProps in MenuListWithFooter
        orgSlug={orgSlug}
        components={MENU_COMPONENTS}
      />
      {errors[conditionGroupId] && (
        <Alert variant="danger">{errors[conditionGroupId]}</Alert>
      )}
    </Fragment>
  );
}

function Node() {
  const {action} = useActionNodeContext();
  const node = actionNodesMap.get(action.type);

  const Component = node?.action;
  return Component ? <Component /> : node?.label;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;

const AddIntegrationFooter = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.border};
`;
