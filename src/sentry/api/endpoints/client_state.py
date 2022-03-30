# This endpoint helps managing persisted client state with a TTL for a member, organization or user

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.utils import json, redis

STATE_CATEGORIES = {
    "onboarding": {
        "ttl": 30 * 24 * 60 * 60,  # the time in seconds that the state will be persisted
        "scope": "member",  # Can be "user", "org", or "user-org"
    }
}


class ClientStateEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get_key(self, request: Request, category):
        scope = STATE_CATEGORIES[category]["scope"]
        org = request.query_params.get("org")
        if scope == "member":
            if not org:
                raise ParameterValidationError("Missing org parameter")
            return f"client-state:{category}:{org}:{request.user.id}"
        elif scope == "org":
            if not org:
                raise ParameterValidationError("Missing org parameter")
            return f"client-state:{category}:{org}"
        else:
            return f"client-state:{category}:{request.user.id}"

    def get(self, request: Request, category) -> Response:
        if category not in STATE_CATEGORIES:
            return Response({"detail": "Category not found"}, status=404)
        key = self.get_key(request, category)
        res = None
        with redis.clusters.get("default").map() as client:
            res = client.get(key)
            client.expire(key, STATE_CATEGORIES[category]["ttl"])
        if res.value:
            return Response(res.value)
        else:
            return Response({})

    def put(self, request: Request, category):
        if category not in STATE_CATEGORIES:
            return Response({"detail": "Category not found"}, status=404)
        key = self.get_key(request, category)
        with redis.clusters.get("default").map() as client:
            client.setex(key, STATE_CATEGORIES[category]["ttl"], json.dumps(request.data))
        return Response(status=201)
