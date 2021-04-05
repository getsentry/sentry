from typing import Any, Dict, Mapping, Optional, Set, Union

from sentry.api.exceptions import ParameterValidationError
from sentry.models.integration import ExternalProviders
from sentry.notifications.helpers import validate as helper_validate
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


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


def validate_provider_option(provider: Optional[str]) -> Optional[ExternalProviders]:
    return validate_provider(provider) if provider else None


def validate_type(type: str, context: Optional[str] = None) -> NotificationSettingTypes:
    try:
        return NotificationSettingTypes(type)
    except ValueError:
        raise ParameterValidationError(f"Unknown type: {type} in {context}")


def validate_scope_type(scope_type: str, context: Optional[str] = None) -> NotificationScopeType:
    try:
        return NotificationScopeType(scope_type)
    except ValueError:
        raise ParameterValidationError(f"Unknown scope_type: {scope_type} in {context}")


def validate_scope(
    scope_id: Union[int, str],
    scope_type: NotificationScopeType,
    user: Optional[Any] = None,
    context: Optional[str] = None,
) -> int:
    if user and scope_type == NotificationScopeType.USER:
        # Overwrite every user ID with the current user's ID.
        scope_id = user.id

    try:
        return int(scope_id)
    except ValueError:
        raise ParameterValidationError(f"Invalid ID: {scope_id} in {context}")


def validate_provider(provider: str, context: Optional[str] = None) -> ExternalProviders:
    try:
        return ExternalProviders(provider)
    except ValueError:
        raise ParameterValidationError(f"Unknown provider: {provider} in {context}")


def validate_value(
    type: NotificationSettingTypes, value: str, context: Optional[str] = None
) -> NotificationSettingOptionValues:
    try:
        value = NotificationSettingOptionValues(value)
    except ValueError:
        raise ParameterValidationError(f"Unknown value: {value} in {context}")

    if not helper_validate(type, value):
        raise ParameterValidationError(f"Invalid value for type {type}: {value} in {context}")
    return value
