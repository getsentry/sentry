from __future__ import annotations

from typing import Any, Mapping, MutableMapping

from django.urls import reverse

from sentry import eventstore
from sentry.api.serializers import Serializer
from sentry.models import Organization, Project, SentryApp
from sentry.utils.sentry_apps.webhooks import TIMEOUT_STATUS_CODE


class RequestSerializer(Serializer):
    def __init__(self, sentry_app: SentryApp) -> None:
        self.sentry_app = sentry_app

    def get_attrs(self, item_list: list[Any], user: Any, **kwargs: Any) -> MutableMapping[Any, Any]:
        project_ids = {item.data.get("project_id") for item in item_list}
        projects = Project.objects.filter(id__in=project_ids)
        projects_by_id = {project.id: project for project in projects}

        organization_ids = {item.data.get("organization_id") for item in item_list}
        organizations = Organization.objects.filter(id__in=organization_ids)
        organizations_by_id = {organization.id: organization for organization in organizations}

        return {
            item: {
                "organization": organizations_by_id.get(item.data.get("organization_id")),
                "project": projects_by_id.get(item.data.get("project_id")),
            }
            for item in item_list
        }

    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> Mapping[str, Any]:
        organization = attrs.get("organization")
        project = attrs.get("project")
        response_code = obj.data.get("response_code")

        data = {
            "webhookUrl": obj.data.get("webhook_url"),
            "sentryAppSlug": self.sentry_app.slug,
            "eventType": obj.data.get("event_type"),
            "date": obj.data.get("date"),
            "responseCode": response_code,
        }

        if response_code >= 400 or response_code == TIMEOUT_STATUS_CODE:
            # add error data to display in Sentry app dashboard
            data.update(
                {
                    "requestBody": obj.data.get("request_body"),
                    "requestHeaders": obj.data.get("request_headers"),
                    "responseBody": obj.data.get("response_body"),
                }
            )

        if project and "error_id" in obj.data:
            # Make sure the project actually belongs to the org that owns the Sentry App
            if project.organization_id == self.sentry_app.owner_id:
                # Make sure the event actually exists
                event = eventstore.get_event_by_id(project.id, obj.data["error_id"])
                if event is not None and event.group_id is not None:
                    data["errorUrl"] = reverse(
                        "sentry-organization-event-detail",
                        args=[project.organization.slug, event.group_id, event.event_id],
                    )

        if organization:
            data["organization"] = {"name": organization.name, "slug": organization.slug}

        return data
