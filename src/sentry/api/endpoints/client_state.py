from django.conf import settings
from django.http import HttpResponse
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import pending_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.utils import json, redis
from sentry.utils.client_state import STATE_CATEGORIES, get_client_state_key, get_redis_client

# This endpoint helps managing persisted client state with a TTL for a member, organization or user


@pending_silo_endpoint
class ClientStateListEndpoint(OrganizationEndpoint):
    def __init__(self, **options) -> None:
        cluster_key = getattr(settings, "SENTRY_CLIENT_STATE_REDIS_CLUSTER", "default")
        self.client = redis.redis_clusters.get(cluster_key)
        super().__init__(**options)

    def get(self, request: Request, organization) -> Response:
        result = {}
        for category in STATE_CATEGORIES:
            key = get_client_state_key(organization.slug, category, request.user)
            value = self.client.get(key)
            if value:
                result[category] = json.loads(value)
        return Response(result)


@pending_silo_endpoint
class ClientStateEndpoint(OrganizationEndpoint):
    def __init__(self, **options) -> None:
        self.client = get_redis_client()
        super().__init__(**options)

    def convert_args(self, request: Request, organization_slug, *args, **kwargs):
        (args, kwargs) = super().convert_args(request, organization_slug, *args, **kwargs)
        organization = kwargs["organization"]
        category = kwargs["category"]
        key = get_client_state_key(organization.slug, category, request.user)
        if not key:
            raise NotFound(detail="Category not found")

        kwargs["key"] = key
        return (args, kwargs)

    def get(self, request: Request, organization, category, key) -> Response:
        value = self.client.get(key)
        if value:
            response = HttpResponse(value)
            response["Content-Type"] = "application/json"
            return response
        else:
            return Response({})

    def put(self, request: Request, organization, category, key):
        data_to_write = json.dumps(request.data)
        if len(data_to_write) > STATE_CATEGORIES[category]["max_payload_size"]:
            return Response(status=413)
        self.client.setex(key, STATE_CATEGORIES[category]["ttl"], data_to_write)
        return Response(status=201)

    def delete(self, request: Request, organization, category, key):
        self.client.delete(key)
        return Response(status=204)
