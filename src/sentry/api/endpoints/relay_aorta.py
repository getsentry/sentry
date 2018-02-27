from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.authentication import RelayAuthentication
from sentry.api.permissions import RelayPermission
from sentry.relay import query


class RelayAortaEndpoint(Endpoint):
    # TODO(hazat): have relay auth
    authentication_classes = (RelayAuthentication, )
    permission_classes = (RelayPermission, )

    def post(self, request):
        from sentry.coreapi import ClientApiHelper
        helper = ClientApiHelper()

        # relay = signature.resolve(request.auth)

        try:
            body = helper.safely_load_json_string(request.body)
            response = query.parse(body)
        except query.InvalidQuery as exc:
            return Response(exc.response, status=exc.status_code)

        return Response(response, status=200)


class RelayHeartbeatEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication, )
    permission_classes = (RelayPermission, )

    def post(self, request):
        # TODO(hazat): bump last seen in relay
        return Response(status=200)
