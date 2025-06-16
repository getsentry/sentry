from __future__ import annotations

from rest_framework.request import Request

from sentry.api.base import Endpoint


class CodecovEndpoint(Endpoint):
    """
    Used for endpoints that are specific to Codecov / Prevent.
    """

    permission_classes = ()

    def convert_args(self, request: Request, *args, **kwargs):
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)
        # TODO: in case we need to modify args, do it here
        return (parsed_args, parsed_kwargs)
