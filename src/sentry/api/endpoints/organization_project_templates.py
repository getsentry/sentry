from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_template import ProjectTemplateSerializer
from sentry.models.projecttemplate import ProjectTemplate


class PostProjectTemplateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    organization_id = serializers.IntegerField()

    def create(self, validated_data):
        return ProjectTemplate.objects.create(**validated_data)


class OrganizationProjectTemplatesEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization) -> Response:
        queryset = ProjectTemplate.objects.filter(organization=organization)
        order_by = ["date_added"]

        def serialize_on_result(result):
            serializer = ProjectTemplateSerializer()
            return serialize(result, request.user, serializer)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=serialize_on_result,
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
        serializer = PostProjectTemplateSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.save(organization=organization)
            return Response(serialize(result, request.user, ProjectTemplateSerializer()))

        return Response(serializer.errors, status=400)
