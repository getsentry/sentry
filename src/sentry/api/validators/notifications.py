from typing import List, Optional

from sentry.api.exceptions import ParameterValidationError
from sentry.notifications.helpers import validate as helper_validate
from sentry.notifications.types import (
    NOTIFICATION_SCOPE_TYPE,
    NOTIFICATION_SETTING_OPTION_VALUES,
    NOTIFICATION_SETTING_TYPES,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


def validate_type(type: str, context: Optional[List[str]] = None) -> NotificationSettingTypes:
    try:
        return {v: k for k, v in NOTIFICATION_SETTING_TYPES.items()}[type]
    except KeyError:
        raise ParameterValidationError(f"Unknown type: {type}", context)


def validate_scope_type(
    scope_type: str, context: Optional[List[str]] = None
) -> NotificationScopeType:
    try:
        return {v: k for k, v in NOTIFICATION_SCOPE_TYPE.items()}[scope_type]
    except KeyError:
        raise ParameterValidationError(f"Unknown scope_type: {scope_type}", context)


def validate_value(
    type: NotificationSettingTypes, value_param: str, context: Optional[List[str]] = None
) -> NotificationSettingOptionValues:
    try:
        value = {v: k for k, v in NOTIFICATION_SETTING_OPTION_VALUES.items()}[value_param]
    except KeyError:
        raise ParameterValidationError(f"Unknown value: {value_param}", context)

    if value != NotificationSettingOptionValues.DEFAULT and not helper_validate(type, value):
        raise ParameterValidationError(f"Invalid value for type {type}: {value}", context)
    return value
