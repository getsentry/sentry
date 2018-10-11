from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features


def requires_feature(feature, any_org=None):
    def decorator(func):
        def wrapped(self, request, *args, **kwargs):
            # The endpoint is accessible if any of the User's Orgs have the feature
            # flag enabled.
            if any_org:
                if not any(features.has(feature, org) for org in request.user.get_orgs()):
                    return Response(status=404)

                return func(self, request, *args, **kwargs)
            # The Org in scope for the request must have the feature flag enabled.
            else:
                if 'organization' not in kwargs:
                    return Response(status=404)

                if not features.has(feature, kwargs['organization']):
                    return Response(status=404)

                return func(self, request, *args, **kwargs)
        return wrapped
    return decorator
