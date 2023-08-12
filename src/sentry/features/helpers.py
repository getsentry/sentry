from typing import TYPE_CHECKING, Any, Callable, Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features

if TYPE_CHECKING:
    from sentry.models import Organization

# TODO(mgaeta): It's not currently possible to type a Callable's args with kwargs.
EndpointFunc = Callable[..., Response]


def any_organization_has_feature(
    feature: str, organizations: Sequence["Organization"], **kwargs: Any
) -> bool:
    return any([features.has(feature, organization, **kwargs) for organization in organizations])


def requires_feature(feature: str) -> Callable[[EndpointFunc], EndpointFunc]:
    """
    Require a feature flag to access an endpoint.

    The endpoint must resolve an Organization via
    ``convert_args`` (and therefor be in ``kwargs``). The resolved Org must have
    the passed feature.

    If any failure case, the API returns a 404.

    Example:
        >>> @requires_feature('organizations:performance-view')
        >>> def get(self, request: Request, organization) -> Response:
        >>>     return Response()
    """

    def decorator(func: EndpointFunc) -> EndpointFunc:
        def wrapped(self: Any, request: Request, *args: Any, **kwargs: Any) -> Response:
            if "organization" not in kwargs:
                return Response(status=404)

            if not features.has(feature, kwargs["organization"], actor=request.user):
                return Response(status=404)

            return func(self, request, *args, **kwargs)

        return wrapped

    return decorator
