from __future__ import absolute_import

import time

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from graphene_django.views import GraphQLView
from rest_framework.views import APIView
from rest_framework.response import Response

from .authentication import ApiKeyAuthentication, TokenAuthentication
from rest_framework.authentication import SessionAuthentication
from sentry.api.permissions import SentryPermission
from sentry.utils.http import is_valid_origin


class GraphQLAccessPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read', 'event:read', 'member:read', 'project:read', 'team:read'],
        'POST': ['org:read', 'event:read', 'member:read', 'project:read', 'team:read'],
    }


class SentryGraphQLView(APIView, GraphQLView):
    permission_classes = (GraphQLAccessPermission, )
    authentication_classes = (TokenAuthentication, ApiKeyAuthentication, SessionAuthentication,)

    def initialize_request(self, request, *args, **kwargs):
        rv = super(SentryGraphQLView, self).initialize_request(request, *args, **kwargs)
        # If our request is being made via our internal API client, we need to
        # stitch back on auth and user information
        if getattr(request, '__from_api_client__', False):
            if rv.auth is None:
                rv.auth = getattr(request, 'auth', None)
            if rv.user is None:
                rv.user = getattr(request, 'user', None)
        return rv

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        request = self.initialize_request(request, *args, **kwargs)
        self.headers = self.default_response_headers

        request._metric_tags = {}

        if settings.SENTRY_API_RESPONSE_DELAY:
            time.sleep(settings.SENTRY_API_RESPONSE_DELAY / 1000.0)

        origin = request.META.get('HTTP_ORIGIN', 'null')
        # A "null" value should be treated as no Origin for us.
        # See RFC6454 for more information on this behavior.
        if origin == 'null':
            origin = None

        try:
            if origin and request.auth:
                allowed_origins = request.auth.get_allowed_origins()
                if not is_valid_origin(origin, allowed=allowed_origins):
                    response = Response('Invalid origin: %s' %
                                        (origin, ), status=400)
                    self.response = self.finalize_response(
                        request, response, *args, **kwargs)
                    return self.response

            self.initial(request, *args, **kwargs)
            response = GraphQLView.as_view()(request)

        except Exception as exc:
            response = self.handle_exception(exc)

        if origin:
            self.add_cors_headers(request, response)

        self.response = self.finalize_response(
            request, response, *args, **kwargs)
        return self.response
