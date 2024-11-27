from collections.abc import Callable

from sentry.models.group import GroupEvent
from sentry.utils.registry import NoRegistrationExistsError, Registry
from sentry.workflow_engine.models.action import Action

ActionHandler = Callable[[Action, GroupEvent], None]

# Create a registry for action handlers
action_handler_registry: Registry[ActionHandler] = Registry[ActionHandler]()


def register_action_handler(action_types: list[Action.Type]):
    """
    Decorator to register a handler for specific action types.

    Usage:
    @register_action_handler([Action.Type.NOTIFICATION_SLACK, Action.Type.NOTIFICATION_DISCORD])
    def notification_action_handler(action: Action, group_event: GroupEvent):
        ...
    """

    def decorator(handler_class: ActionHandler):
        for action_type in action_types:
            action_handler_registry.register(action_type.value)(handler_class)
        return handler_class

    return decorator


def get_handler(action: Action) -> ActionHandler:
    """Get the handler instance for a given action."""
    try:
        handler_class = action_handler_registry.get(action.type.value)
        return handler_class()
    except NoRegistrationExistsError:
        raise ValueError(f"No handler found for action type: {action.type}")


def trigger_action(action: Action, group_event: GroupEvent):
    """Helper function to trigger an action."""
    handler = get_handler(action)
    handler.trigger(action, group_event)
