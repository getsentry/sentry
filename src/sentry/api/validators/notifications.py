from typing import Any, Dict, Iterable, List, Mapping, Optional, Set, Tuple, Union

from sentry.api.exceptions import ParameterValidationError
from sentry.api.validators.integrations import validate_provider
from sentry.notifications.helpers import validate as helper_validate
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
    """ Get the sub-dictionary where the keys are in the intersections the original keys and the set. """
    # TODO(mgaeta): Genericize the key type and move to sentry.utils.
    return {k: v for k, v in d.items() if k in s}


def validate_organizations(
    organization_ids_to_look_up: Set[int],
    user: Optional[Any] = None,
    team: Optional[Any] = None,
) -> Mapping[int, Any]:
    if not organization_ids_to_look_up:
        return {}

    if user:
        organizations_by_id = {organization.id: organization for organization in user.get_orgs()}
    elif team:
        organizations_by_id = {team.organization.id: team.organization}
    else:
        raise Exception("User or Team must be set.")

    missing_organization_ids = organization_ids_to_look_up - organizations_by_id.keys()
    if missing_organization_ids:
        raise ParameterValidationError(f"Invalid organization IDs: {missing_organization_ids}")

    return intersect_dict_set(organizations_by_id, organization_ids_to_look_up)


def validate_projects(
    project_ids_to_look_up: Set[int],
    user: Optional[Any] = None,
    team: Optional[Any] = None,
) -> Mapping[int, Any]:
    if not project_ids_to_look_up:
        return {}

    if user:
        projects_by_id = {project.id: project for project in user.get_projects()}
    elif team:
        projects_by_id = {project.id: project for project in team.get_projects()}
    else:
        raise Exception("User or Team must be set.")

    missing_project_ids = project_ids_to_look_up - projects_by_id.keys()
    if missing_project_ids:
        raise ParameterValidationError(f"Invalid project IDs: {missing_project_ids}")

    return intersect_dict_set(projects_by_id, project_ids_to_look_up)


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
        # Overwrite every user ID with the current user's ID.
        scope_id = user.id

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


def validate(
    data: Mapping[str, Mapping[str, Mapping[int, Mapping[str, str]]]],
    user: Optional[Any] = None,
    team: Optional[Any] = None,
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
    project_ids_to_look_up: Set[int] = set()
    organization_ids_to_look_up: Set[int] = set()
    for type_key, notifications_by_type in data.items():
        type = validate_type(type_key, context)
        context = parent_context + [type_key]

        for scope_type_key, notifications_by_scope_type in notifications_by_type.items():
            scope_type = validate_scope_type(scope_type_key, context)
            context = parent_context + [type_key, scope_type_key]
            for scope_id, notifications_by_scope_id in notifications_by_scope_type.items():
                scope_id = validate_scope(scope_id, scope_type, user, context)

                if scope_type == NotificationScopeType.PROJECT:
                    project_ids_to_look_up.add(scope_id)
                elif scope_type == NotificationScopeType.ORGANIZATION:
                    organization_ids_to_look_up.add(scope_id)

                context = parent_context + [type_key, scope_type_key, str(scope_id)]
                for provider_key, value_key in notifications_by_scope_id.items():
                    provider = validate_provider(provider_key, context=context)
                    value = validate_value(type, value_key, context)

                    notification_settings_to_update[(type, scope_type, scope_id, provider)] = value

    validate_projects(project_ids_to_look_up, user=user, team=team)
    validate_organizations(organization_ids_to_look_up, user=user, team=team)

    return {
        (provider, type, scope_type, scope_id, value)
        for (
            type,
            scope_type,
            scope_id,
            provider,
        ), value in notification_settings_to_update.items()
    }
