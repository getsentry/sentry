from django.utils.text import slugify
from iniconfig import ParseError
from rest_framework import serializers, status

from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.serializers import serialize
from sentry.api.serializers.models.funnel import FunnelSerializer
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.api.utils import InvalidParams
from sentry.models.funnel import Funnel
from sentry.snuba.referrer import Referrer
from sentry.utils import json


class FunnelInputSerializer(CamelSnakeSerializer):
    starting_transaction = serializers.CharField(required=True)
    ending_transaction = serializers.CharField(required=True)
    project = serializers.IntegerField(required=True)
    name = serializers.CharField(required=True)


class FunnelIndexEndpoint(OrganizationEventsV2EndpointBase):
    def post(self, request, organization):
        serializer = FunnelInputSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)
        data = serializer.validated_data

        slug = slugify(data["name"])

        funnel = Funnel.objects.create(
            project_id=data["project"],
            starting_transaction=data["starting_transaction"],
            ending_transaction=data["ending_transaction"],
            name=data["name"],
            slug=slug,
        )

        return self.respond(
            serialize(funnel, request.user, serializer=FunnelSerializer()), status=201
        )

    def get(self, request, organization):
        projects = map(lambda x: x.id, self.get_projects(request, organization))
        funnels = list(Funnel.objects.filter(project_id__in=projects))
        print("funnels", funnels)
        return self.respond(
            serialize(funnels, request.user, serializer=FunnelSerializer()), status=200
        )
