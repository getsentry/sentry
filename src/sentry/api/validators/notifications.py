from typing import AbstractSet, Any, Dict, Iterable, List, Mapping, Optional, Set, Tuple, Union

from sentry.api.exceptions import ParameterValidationError
from sentry.api.validators.integrations import validate_provider
from sentry.notifications.helpers import validate as helper_validate
from sentry.notifications.helpers import validate_v2 as helper_validate_v2
from sentry.notifications.types import (
    NOTIFICATION_SCOPE_TYPE,
    NOTIFICATION_SETTING_OPTION_VALUES,
    NOTIFICATION_SETTING_TYPES,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders


def intersect_dict_set(d: Dict[int, Any], s: Set[int]) -> Dict[int, Any]:
    """Get the sub-dictionary where the keys are in the intersections the original keys and the set."""
    # TODO(mgaeta): Genericize the key type and move to sentry.utils.
    return {k: v for k, v in d.items() if k in s}


def validate_type_option(type: Optional[str]) -> Optional[NotificationSettingTypes]:
    return validate_type(type) if type else None


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


def validate_scope(
    scope_id: Union[int, str],
    scope_type: NotificationScopeType,
    user: Optional[Any] = None,
    context: Optional[List[str]] = None,
) -> int:
    if user and scope_type == NotificationScopeType.USER:
        if scope_id == "me":
            # Overwrite "me" with the current user's ID.
            scope_id = user.id
        elif scope_id != str(user.id):
            raise ParameterValidationError(f"Incorrect user ID: {scope_id}", context)

    try:
        return int(scope_id)
    except ValueError:
        raise ParameterValidationError(f"Invalid ID: {scope_id}", context)


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


def validate_value_v2(
    type: NotificationSettingTypes, value_param: str, context: Optional[List[str]] = None
) -> NotificationSettingOptionValues:
    try:
        value = {v: k for k, v in NOTIFICATION_SETTING_OPTION_VALUES.items()}[value_param]
    except KeyError:
        raise ParameterValidationError(f"Unknown value: {value_param}", context)

    if value != NotificationSettingOptionValues.DEFAULT and not helper_validate_v2(type, value):
        raise ParameterValidationError(f"Invalid value for type {type}: {value}", context)
    return value


def get_valid_items(
    data: Mapping[Any, Any], context: Optional[List[str]] = None
) -> AbstractSet[Any]:
    try:
        return data.items()
    except AttributeError:
        raise ParameterValidationError("Malformed JSON in payload", context)


def validate(
    data: Mapping[str, Mapping[str, Mapping[int, Mapping[str, str]]]],
    user: Optional[Any] = None,
) -> Iterable[
    Tuple[
        ExternalProviders,
        NotificationSettingTypes,
        NotificationScopeType,
        int,
        NotificationSettingOptionValues,
    ],
]:
    """
    Validate some serialized notification settings. If invalid, raise an
    exception. Otherwise, return them as a list of tuples.
    """

    if not data:
        raise ParameterValidationError("Payload required")

    parent_context = ["notification_settings"]
    context = parent_context
    notification_settings_to_update: Dict[
        Tuple[
            NotificationSettingTypes,
            NotificationScopeType,
            int,
            ExternalProviders,
        ],
        NotificationSettingOptionValues,
    ] = {}
    for type_key, notifications_by_type in get_valid_items(data, context):
        type = validate_type(type_key, context)
        context = parent_context + [type_key]

        for scope_type_key, notifications_by_scope_type in get_valid_items(
            notifications_by_type, context
        ):
            scope_type = validate_scope_type(scope_type_key, context)
            context = parent_context + [type_key, scope_type_key]
            for scope_id, notifications_by_scope_id in get_valid_items(
                notifications_by_scope_type, context
            ):
                scope_id = validate_scope(scope_id, scope_type, user, context)

                context = parent_context + [type_key, scope_type_key, str(scope_id)]
                for provider_key, value_key in get_valid_items(notifications_by_scope_id, context):
                    provider = validate_provider(provider_key, context=context)
                    value = validate_value(type, value_key, context)

                    notification_settings_to_update[(type, scope_type, scope_id, provider)] = value

    return {
        (provider, type, scope_type, scope_id, value)
        for (
            type,
            scope_type,
            scope_id,
            provider,
        ), value in notification_settings_to_update.items()
    }
