# This endpoint helps managing persisted client state with a TTL for a member, organization or user

from django.conf import settings
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.utils import json, redis

STATE_CATEGORIES = {
    "onboarding": {
        "ttl": 30 * 24 * 60 * 60,  # the time in seconds that the state will be persisted
        "scope": "member",  # Can be "org" or "member"
        "max_payload_size": 1024,
    }
}


class ClientStateEndpoint(OrganizationEndpoint):
    private = True

    def __init__(self, **options) -> None:
        cluster_key = getattr(settings, "SENTRY_CLIENT_STATE_REDIS_CLUSTER", "default")
        self.client = redis.redis_clusters.get(cluster_key)
        super().__init__(**options)

    def get_key(self, organization, category, user):
        if category not in STATE_CATEGORIES:
            raise NotFound(detail="Category not found")
        scope = STATE_CATEGORIES[category]["scope"]
        if scope == "member":
            return f"client-state:{category}:{organization}:{user}"
        elif scope == "org":
            return f"client-state:{category}:{organization}"

    def get(self, request: Request, organization, category) -> Response:
        key = self.get_key(organization.slug, category, request.user)
        res = self.client.get(key)
        if res:
            self.client.expire(key, STATE_CATEGORIES[category]["ttl"])
            return Response(json.loads(res))
        else:
            return Response({})

    def put(self, request: Request, organization, category):
        key = self.get_key(organization.slug, category, request.user)
        data_to_write = json.dumps(request.data)
        if len(data_to_write) > STATE_CATEGORIES[category]["max_payload_size"]:
            return Response(status=413)
        self.client.setex(key, STATE_CATEGORIES[category]["ttl"], data_to_write)
        return Response(status=201)
