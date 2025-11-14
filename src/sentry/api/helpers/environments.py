from __future__ import annotations

import functools
from collections.abc import Callable
from typing import int, TYPE_CHECKING

from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.environment import Environment

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.organizations.services.organization import RpcOrganization

environment_visibility_filter_options = {
    "all": lambda queryset: queryset,
    "hidden": lambda queryset: queryset.filter(is_hidden=True),
    "visible": lambda queryset: queryset.exclude(is_hidden=True),
}


def get_environment(request: Request, organization_id: int) -> Environment | None:
    environment_param = request.GET.get("environment")
    if environment_param is None:
        return None
    else:
        return Environment.get_for_organization_id(
            name=environment_param, organization_id=organization_id
        )


def get_environment_id(request: Request, organization_id: int) -> int | None:
    environment = get_environment(request, organization_id)
    return environment.id if environment is not None else None


def get_environment_func(
    request: Request, organization_id: int
) -> Callable[[], Environment | None]:
    @functools.cache
    def environment_func() -> Environment | None:
        return get_environment(request, organization_id)

    return environment_func


def get_environments(
    request: Request, organization: Organization | RpcOrganization
) -> list[Environment]:
    requested_environments = set(request.GET.getlist("environment"))

    if not requested_environments:
        return []

    environments = list(
        Environment.objects.filter(organization_id=organization.id, name__in=requested_environments)
    )

    if set(requested_environments) != {e.name for e in environments}:
        raise ResourceDoesNotExist

    return environments
