from typing import List, Optional

from sentry.api.exceptions import ParameterValidationError
from sentry.notifications.helpers import validate as helper_validate
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)


def validate_type(type: str, context: Optional[List[str]] = None) -> NotificationSettingEnum:
    try:
        return NotificationSettingEnum(type)
    except ValueError:
        raise ParameterValidationError(f"Unknown type: {type}", context)


def validate_scope_type(
    scope_type: str, context: Optional[List[str]] = None
) -> NotificationScopeEnum:
    try:
        return NotificationScopeEnum(scope_type)
    except ValueError:
        raise ParameterValidationError(f"Unknown scope_type: {scope_type}", context)


def validate_value(
    type: NotificationSettingEnum, value_param: str
) -> NotificationSettingsOptionEnum:
    try:
        value = NotificationSettingsOptionEnum(value_param)
    except ValueError:
        raise ParameterValidationError(f"Unknown value: {value_param}")

    if value != NotificationSettingsOptionEnum.DEFAULT and not helper_validate(type, value):
        raise ParameterValidationError(f"Invalid value for type {type}: {value}")
    return value
