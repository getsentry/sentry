from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.authentication import AgentAuthentication
from sentry.api.permissions import AgentPermission
# from sentry.agent import signature
from sentry.agent import query


class AgentAortaEndpoint(Endpoint):
    # TODO(hazat): have agent auth
    authentication_classes = (AgentAuthentication, )
    permission_classes = (AgentPermission, )

    def post(self, request):
        from sentry.coreapi import ClientApiHelper
        helper = ClientApiHelper()

        # agent = signature.resolve(request.auth)

        try:
            body = helper.safely_load_json_string(request.body)
            response = query.parse(body)
        except query.InvalidQuery as exc:
            return Response(exc.response, status=exc.status_code)

        return Response(response, status=200)


class AgentHeartbeatEndpoint(Endpoint):
    authentication_classes = (AgentAuthentication, )
    permission_classes = (AgentPermission, )

    def post(self, request):
        # TODO(hazat): bump last seen in agent
        return Response(status=200)
