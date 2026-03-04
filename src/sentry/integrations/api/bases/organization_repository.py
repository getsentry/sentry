from __future__ import annotations

from typing import Any

from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization
from sentry.models.repository import Repository


class OrganizationRepositoryEndpoint(OrganizationEndpoint):
    """Base endpoint that resolves repo_id to a Repository in convert_args."""

    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        organization: Organization = kwargs["organization"]
        repo_id = kwargs.pop("repo_id")
        try:
            kwargs["repo"] = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
