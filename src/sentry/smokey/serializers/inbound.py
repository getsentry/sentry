from rest_framework import serializers

from sentry.models.organizationmember import OrganizationMember
from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.models.incidentcomponent import IncidentComponent


class IncidentComponentInboundSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status_page_component_id = serializers.CharField(
        max_length=255, required=False, allow_blank=True, allow_null=True
    )
    parent_component = serializers.IntegerField(required=False, allow_null=True)

    def validate_parent_component(self, value):
        if value is not None:
            try:
                parent_component = IncidentComponent.objects.get(
                    id=value, organization=self.context["organization"]
                )
            except IncidentComponent.DoesNotExist:
                raise serializers.ValidationError("Parent incident component does not exist")
        return parent_component


class IncidentCaseTemplateInboundSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    case_handle = serializers.CharField(max_length=8, required=False, default="INC")
    severity_handle = serializers.CharField(max_length=8, required=False, default="SEV")
    severity_labels = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    case_lead_title = serializers.CharField(max_length=255, required=False, default="Commander")
    update_frequency_minutes = serializers.IntegerField(required=False, allow_null=True)
    schedule_provider = serializers.ChoiceField(
        choices=[("sentry", "Sentry"), ("pagerduty", "PagerDuty")], required=False, allow_null=True
    )
    schedule_config = serializers.JSONField(required=False, default=dict)
    task_provider = serializers.ChoiceField(
        choices=[("sentry", "Sentry"), ("jira", "Jira"), ("linear", "Linear")],
        required=False,
        allow_null=True,
    )
    task_config = serializers.JSONField(required=False, default=dict)
    channel_provider = serializers.ChoiceField(
        choices=[("slack", "Slack"), ("discord", "Discord"), ("teams", "Microsoft Teams")],
        required=False,
        allow_null=True,
    )
    channel_config = serializers.JSONField(required=False, default=dict)
    status_page_provider = serializers.ChoiceField(
        choices=[("sentry", "Sentry"), ("statuspage", "Statuspage")],
        required=False,
        allow_null=True,
    )
    status_page_config = serializers.JSONField(required=False, default=dict)
    retro_provider = serializers.ChoiceField(
        choices=[
            ("sentry", "Sentry"),
            ("notion", "Notion"),
            ("google-docs", "Google Docs"),
            ("confluence", "Confluence"),
        ],
        required=False,
        allow_null=True,
    )
    retro_config = serializers.JSONField(required=False, default=dict)

    def validate_name(self, value):
        if IncidentCaseTemplate.objects.filter(
            organization=self.context["organization"], name=value
        ).exists():
            raise serializers.ValidationError("Incident case template name must be unique")
        return value


class IncidentCaseInboundSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    status = serializers.CharField(max_length=255)
    severity = serializers.IntegerField(required=True, min_value=0, max_value=10)
    description = serializers.CharField(required=False)
    summary = serializers.CharField(required=False)
    template = serializers.IntegerField(required=True)
    case_lead = serializers.IntegerField(required=True)
    schedule_record = serializers.JSONField(required=False, default=dict)
    task_record = serializers.JSONField(required=False, default=dict)
    channel_record = serializers.JSONField(required=False, default=dict)
    status_page_record = serializers.JSONField(required=False, default=dict)
    retro_record = serializers.JSONField(required=False, default=dict)
    affected_components = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )

    def validate_template(self, value):
        try:
            template = IncidentCaseTemplate.objects.get(
                id=value, organization=self.context["organization"]
            )
        except IncidentCaseTemplate.DoesNotExist:
            raise serializers.ValidationError("Incident case template does not exist")
        return template

    def validate_case_lead(self, value):
        try:
            member = OrganizationMember.objects.get(
                id=value, organization=self.context["organization"]
            )
        except OrganizationMember.DoesNotExist:
            raise serializers.ValidationError("Case lead must be a valid organization member")
        return member

    def validate_affected_components(self, value):
        for component in value:
            try:
                IncidentComponent.objects.get(
                    id=component, organization=self.context["organization"]
                )
            except IncidentComponent.DoesNotExist:
                raise serializers.ValidationError("Affected component does not exist")
        return value
