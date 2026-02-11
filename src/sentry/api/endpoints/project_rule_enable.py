import sentry_sdk
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.analytics.events.rule_reenable import RuleReenableExplicit
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.endpoints.project_rules import find_duplicate_rule
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.models.rule import Rule
from sentry.workflow_engine.utils.legacy_metric_tracking import (
    report_used_legacy_models,
    track_alert_endpoint_execution,
)


@region_silo_endpoint
class ProjectRuleEnableEndpoint(ProjectEndpoint):
    publish_status = {
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    @track_alert_endpoint_execution("PUT", "sentry-api-0-project-rule-enable")
    def put(self, request: Request, project, rule_id) -> Response:
        # Mark that we're using legacy Rule models (before query to track failures too)
        report_used_legacy_models()

        try:
            rule = Rule.objects.get(id=rule_id, project=project)
        except Rule.DoesNotExist:
            raise ResourceDoesNotExist

        if rule.status != ObjectStatus.DISABLED:
            return Response(
                {
                    "detail": "Rule is not disabled.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not rule.data.get("actions", []):
            return Response(
                {
                    "detail": "Cannot enable a rule with no action.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        duplicate_rule = find_duplicate_rule(project=project, rule_id=rule_id, rule=rule)
        if duplicate_rule:
            return Response(
                {
                    "detail": f"This rule is an exact duplicate of '{duplicate_rule.label}' in this project and may not be enabled unless it's edited."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        rule.status = ObjectStatus.ACTIVE
        rule.save()
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_EDIT"),
            data=rule.get_audit_log_data(),
        )
        try:
            analytics.record(
                RuleReenableExplicit(
                    rule_id=rule.id,
                    user_id=request.user.id,
                    organization_id=project.organization.id,
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
        return Response(status=202)
