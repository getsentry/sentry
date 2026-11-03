from typing import Any

from drf_spectacular.utils import OpenApiParameter
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist, UserRequired
from sentry.apidocs.parameters import CursorQueryParam
from sentry.auth.principal import has_user

PAGINATION_PARAMETERS = [
    CursorQueryParam,
    OpenApiParameter(
        "per_page", int, description="Results per page, from 1 to 100. Defaults to 25."
    ),
]


class OrganizationInboxEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    requires_user = True

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has(
            "organizations:universal-inbox", kwargs["organization"], actor=request.user
        ):
            raise ResourceDoesNotExist
        if not has_user(request.user):
            raise UserRequired
        return args, kwargs
