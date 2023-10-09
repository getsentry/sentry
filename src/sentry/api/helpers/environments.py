from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.environment import Environment

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.services.hybrid_cloud.organization import RpcOrganization

environment_visibility_filter_options = {
    "all": lambda queryset: queryset,
    "hidden": lambda queryset: queryset.filter(is_hidden=True),
    "visible": lambda queryset: queryset.exclude(is_hidden=True),
}


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
