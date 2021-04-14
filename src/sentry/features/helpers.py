from rest_framework.response import Response

from sentry import features


def requires_feature(feature, any_org=None):
    """
    Require a feature flag to access an endpoint.

    If ``any_org`` is ``True``, this will check all of the request User's
    Organizations for the flag. If any are flagged in, the endpoint is accessible.

    Without ``any_org=True``, the endpoint must resolve an Organization via
    ``convert_args`` (and therefor be in ``kwargs``). The resolved Org must have
    the passed feature.

    If any failure case, the API returns a 404.

    Example:
        >>> @requires_feature('organizations:internal-catchall')
        >>> def get(self, request, organization):
        >>>     return Response()
    """

    def decorator(func):
        def wrapped(self, request, *args, **kwargs):
            # The endpoint is accessible if any of the User's Orgs have the feature
            # flag enabled.
            if any_org:
                if not any(
                    features.has(feature, org, actor=request.user)
                    for org in request.user.get_orgs()
                ):
                    return Response(status=404)

                return func(self, request, *args, **kwargs)
            # The Org in scope for the request must have the feature flag enabled.
            else:
                if "organization" not in kwargs:
                    return Response(status=404)

                if not features.has(feature, kwargs["organization"], actor=request.user):
                    return Response(status=404)

                return func(self, request, *args, **kwargs)

        return wrapped

    return decorator
