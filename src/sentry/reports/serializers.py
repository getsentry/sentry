from __future__ import annotations

from collections import defaultdict
from collections.abc import MutableMapping, Sequence

from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.explore.models import ExploreSavedQuery
from sentry.models.dashboard import Dashboard
from sentry.models.organizationmember import OrganizationMember
from sentry.reports.models import (
    VALID_EXPLORE_DATASETS,
    VALID_TIME_RANGES,
    ScheduledReport,
    ScheduledReportFrequency,
    ScheduledReportSourceType,
)
from sentry.users.services.user.service import user_service

MAX_REPORTS_PER_ORG = 25


class ScheduledReportInputSerializer(serializers.Serializer):
    """Serializer for validating POST/PUT payloads for scheduled reports."""

    name = serializers.CharField(max_length=255)
    sourceType = serializers.ChoiceField(
        choices=[name for _, name in ScheduledReportSourceType.TYPES]
    )
    sourceId = serializers.IntegerField()
    frequency = serializers.ChoiceField(
        choices=[name for _, name in ScheduledReportFrequency.TYPES]
    )
    dayOfWeek = serializers.IntegerField(
        min_value=0, max_value=6, required=False, allow_null=True, default=None
    )
    dayOfMonth = serializers.IntegerField(
        min_value=1, max_value=31, required=False, allow_null=True, default=None
    )
    hour = serializers.IntegerField(min_value=0, max_value=23)
    timeRange = serializers.ChoiceField(
        choices=[(v, v) for v in VALID_TIME_RANGES],
        required=False,
        allow_null=True,
        default=None,
    )
    recipientEmails = serializers.ListField(
        child=serializers.EmailField(), min_length=1, max_length=50
    )

    def validate(self, data):
        organization = self.context["organization"]

        frequency = data["frequency"]
        if frequency == "weekly" and data.get("dayOfWeek") is None:
            raise serializers.ValidationError(
                {"dayOfWeek": "This field is required for weekly frequency."}
            )
        if frequency == "monthly" and data.get("dayOfMonth") is None:
            raise serializers.ValidationError(
                {"dayOfMonth": "This field is required for monthly frequency."}
            )

        source_type = ScheduledReportSourceType.get_id_for_type_name(data["sourceType"])
        frequency_int = ScheduledReportFrequency.get_id_for_type_name(data["frequency"])

        source_id = data["sourceId"]
        if source_type == ScheduledReportSourceType.EXPLORE_SAVED_QUERY:
            try:
                saved_query = ExploreSavedQuery.objects.get(
                    id=source_id, organization_id=organization.id
                )
            except ExploreSavedQuery.DoesNotExist:
                raise serializers.ValidationError(
                    {"sourceId": "Explore saved query not found in this organization."}
                )

            if saved_query.dataset not in VALID_EXPLORE_DATASETS:
                raise serializers.ValidationError(
                    {
                        "sourceId": "This saved query uses an unsupported dataset for scheduled reports."
                    }
                )

            if not saved_query.projects.exists():
                raise serializers.ValidationError(
                    {"sourceId": "Saved query must have at least one project selected."}
                )

            request = self.context.get("request")
            if request and saved_query.projects.exists():
                if not request.access.has_projects_access(saved_query.projects.all()):
                    raise serializers.ValidationError(
                        {"sourceId": "You do not have access to this saved query's projects."}
                    )

        elif source_type == ScheduledReportSourceType.DASHBOARD:
            try:
                Dashboard.objects.get(id=source_id, organization_id=organization.id)
            except Dashboard.DoesNotExist:
                raise serializers.ValidationError(
                    {"sourceId": "Dashboard not found in this organization."}
                )

        self._validate_recipient_emails(data["recipientEmails"], organization)

        data["source_type_int"] = source_type
        data["frequency_int"] = frequency_int

        return data

    def _validate_recipient_emails(self, emails, organization):
        """
        Validate that all recipient emails belong to verified members
        of the organization. Uses the user service RPC for silo safety.
        """
        unique_emails = list({e.lower() for e in emails})

        users = user_service.get_many_by_email(emails=unique_emails, is_verified=True)
        found_emails = {u.email.lower() for u in users}
        missing = set(unique_emails) - found_emails
        if missing:
            raise serializers.ValidationError(
                {
                    "recipientEmails": "All recipient emails must belong to verified users in the system."
                }
            )

        found_user_ids = {u.id for u in users}
        member_user_ids = set(
            OrganizationMember.objects.filter(
                organization_id=organization.id,
                user_id__in=list(found_user_ids),
            ).values_list("user_id", flat=True)
        )

        non_member_ids = found_user_ids - member_user_ids
        if non_member_ids:
            raise serializers.ValidationError(
                {
                    "recipientEmails": "All recipient emails must belong to members of this organization."
                }
            )


@register(ScheduledReport)
class ScheduledReportOutputSerializer(Serializer):
    """Output serializer for ScheduledReport model objects."""

    def get_attrs(self, item_list: Sequence[ScheduledReport], user, **kwargs) -> MutableMapping:
        result: defaultdict[ScheduledReport, dict] = defaultdict(lambda: {"created_by": None})

        creator_ids = [item.created_by_id for item in item_list if item.created_by_id]
        if creator_ids:
            service_serialized = user_service.serialize_many(
                filter={"user_ids": creator_ids},
                as_user=user if user.id else None,
            )
            serialized_users = {u["id"]: u for u in service_serialized}

            for item in item_list:
                result[item]["created_by"] = serialized_users.get(str(item.created_by_id))

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "name": obj.name,
            "sourceType": ScheduledReportSourceType.get_type_name(obj.source_type),
            "sourceId": str(obj.source_id),
            "frequency": ScheduledReportFrequency.get_type_name(obj.frequency),
            "dayOfWeek": obj.day_of_week,
            "dayOfMonth": obj.day_of_month,
            "hour": obj.hour,
            "timeRange": obj.time_range,
            "recipientEmails": obj.recipient_emails,
            "isActive": obj.is_active,
            "nextRunAt": obj.next_run_at.isoformat() if obj.next_run_at else None,
            "createdBy": attrs.get("created_by"),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
