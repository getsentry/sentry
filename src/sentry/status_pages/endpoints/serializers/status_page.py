from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.status_pages.models.status_page import StatusPage


@extend_schema_serializer(
    component_name="StatusPageSerializer",
    examples=[
        {
            "title": "Main Status Page",
            "description": "Our main status page for monitoring service health",
            "is_public": True,
            "is_accepting_subscribers": True,
            "cname": "status.example.com",
        }
    ],
)
class StatusPageSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=64, required=True, help_text="The title of the status page"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="A description of the status page",
    )
    is_public = serializers.BooleanField(
        required=False, default=False, help_text="Whether the status page is publicly accessible"
    )
    is_accepting_subscribers = serializers.BooleanField(
        required=False, default=False, help_text="Whether the status page accepts email subscribers"
    )
    cname = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Custom domain name for the status page",
    )


@extend_schema_serializer(component_name="StatusPageResponseSerializer")
@register(StatusPage)
class StatusPageResponseSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "title": obj.title,
            "description": obj.description,
            "isPublic": obj.is_public,
            "isAcceptingSubscribers": obj.is_accepting_subscribers,
            "cname": obj.cname,
            "organizationId": str(obj.organization_id),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
