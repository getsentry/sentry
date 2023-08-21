from django.utils.text import slugify
from iniconfig import ParseError
from rest_framework import serializers, status

from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.api.utils import InvalidParams
from sentry.models.funnel import Funnel
from sentry.snuba.referrer import Referrer
from sentry.utils import json


class FunnelSerializer(CamelSnakeSerializer):
    starting_transaction = serializers.CharField(required=True)
    ending_transaction = serializers.CharField(required=True)
    project = serializers.IntegerField(required=True)
    name = serializers.CharField(required=True)


class FunnelIndexEndpoint(OrganizationEventsV2EndpointBase):
    def post(self, request, organization):
        serializer = FunnelSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)
        data = serializer.validated_data

        slug = slugify(data["name"])

        Funnel.objects.create(
            project_id=data["project"],
            starting_transaction=data["starting_transaction"],
            ending_transaction=data["ending_transaction"],
            name=data["name"],
            slug=slug,
        )

        return self.respond(data, status=201)
