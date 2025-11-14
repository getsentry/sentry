from __future__ import annotations

from typing import int, Any

from rest_framework.request import Request

from sentry import features
from sentry.api.exceptions import ResourceDoesNotExist

from .organization import OrganizationEndpoint


class FlaggedOrganizationEndpoint(OrganizationEndpoint):
    """
    Set the `feature_flags` property to a list of flags which are required to access the endpoint.
    Set the `require_all_feature_flags` propert (default: True), to only require one of any flags.
    """

    require_all_feature_flags = True

    @property
    def feature_flags(self) -> list[str]:
        raise NotImplementedError(
            "Requires set 'feature_flags' property to restrict this endpoint."
        )

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)
        organization = parsed_kwargs.get("organization")
        feature_gate = [
            features.has(feature, organization, actor=request.user)
            for feature in self.feature_flags
        ]

        # If you need all the flags, but don't have them all...
        if self.require_all_feature_flags and not all(feature_gate):
            raise ResourceDoesNotExist

        # If you don't need all the flags, but don't have any...
        if not self.require_all_feature_flags and not any(feature_gate):
            raise ResourceDoesNotExist

        return (parsed_args, parsed_kwargs)
