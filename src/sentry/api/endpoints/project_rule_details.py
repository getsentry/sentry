from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import RuleSerializer
from sentry.api.serializers.rest_framework.rule import RuleSerializer as DrfRuleSerializer
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.mediators import project_rules
from sentry.models import (
    RuleActivity,
    RuleActivityType,
    RuleSnooze,
    RuleStatus,
    SentryAppComponent,
    Team,
    User,
)
from sentry.models.integrations.sentry_app_installation import (
    SentryAppInstallation,
    prepare_ui_component,
)
from sentry.rules.actions import trigger_sentry_app_action_creators_for_issues
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.signals import alert_rule_edited
from sentry.tasks.integrations.slack import find_channel_id_for_rule
from sentry.utils import metrics
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class ProjectRuleDetailsEndpoint(RuleEndpoint):
    @transaction_start("ProjectRuleDetailsEndpoint")
    def get(self, request: Request, project, rule) -> Response:
        """
        Retrieve a rule

        Return details on an individual rule.

            {method} {path}

        """

        # Serialize Rule object
        serialized_rule = serialize(
            rule, request.user, RuleSerializer(request.GET.getlist("expand", []))
        )

        errors = []
        # Prepare Rule Actions that are SentryApp components using the meta fields
        for action in serialized_rule.get("actions", []):
            if action.get("_sentry_app_installation") and action.get("_sentry_app_component"):
                installation = SentryAppInstallation(**action.get("_sentry_app_installation", {}))
                component = SentryAppComponent(**action.get("_sentry_app_component"))
                component = prepare_ui_component(
                    installation,
                    component,
                    project.slug,
                    action.get("settings"),
                )

                if component is None:
                    errors.append(
                        {"detail": f"Could not fetch details from {installation.sentry_app.name}"}
                    )
                    action["disabled"] = True
                    continue

                action["formFields"] = component.schema.get("settings", {})

                # Delete meta fields
                del action["_sentry_app_installation"]
                del action["_sentry_app_component"]

            # TODO(nisanthan): This is a temporary fix. We need to save both the label and value of the selected choice and not save all the choices.
            if action.get("id") == "sentry.integrations.jira.notify_action.JiraCreateTicketAction":
                for field in action.get("dynamic_form_fields", []):
                    if field.get("choices"):
                        field["choices"] = [
                            p
                            for p in field.get("choices", [])
                            if isinstance(p[0], str) and isinstance(p[1], str)
                        ]

        if len(errors):
            serialized_rule["errors"] = errors

        rule_snooze = RuleSnooze.objects.filter(
            Q(user_id=request.user.id) | Q(user_id=None), rule=rule
        )
        if rule_snooze.exists():
            serialized_rule["snooze"] = True
            snooze = rule_snooze[0]
            if request.user.id == snooze.owner_id:
                created_by = "You"
            else:
                creator_name = user_service.get_user(snooze.owner_id).get_display_name()
                created_by = creator_name
            serialized_rule["snoozeCreatedBy"] = created_by
            serialized_rule["snoozeForEveryone"] = snooze.user_id is None
        else:
            serialized_rule["snooze"] = False

        return Response(serialized_rule)

    @transaction_start("ProjectRuleDetailsEndpoint")
    def put(self, request: Request, project, rule) -> Response:
        """
        Update a rule

        Update various attributes for the given rule.

            {method} {path}
            {{
              "name": "My rule name",
              "conditions": [],
              "filters": [],
              "actions": [],
              "actionMatch": "all",
              "filterMatch": "all"
            }}

        """
        serializer = DrfRuleSerializer(
            context={"project": project, "organization": project.organization},
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            data = serializer.validated_data

            # combine filters and conditions into one conditions criteria for the rule object
            conditions = data.get("conditions", [])
            if "filters" in data:
                conditions.extend(data["filters"])

            kwargs = {
                "name": data["name"],
                "environment": data.get("environment"),
                "project": project,
                "action_match": data["actionMatch"],
                "filter_match": data.get("filterMatch"),
                "conditions": conditions,
                "actions": data["actions"],
                "frequency": data.get("frequency"),
            }
            owner = data.get("owner")
            if owner:
                try:
                    kwargs["owner"] = owner.resolve_to_actor().id
                except (User.DoesNotExist, Team.DoesNotExist):
                    return Response(
                        "Could not resolve owner",
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if data.get("pending_save"):
                client = RedisRuleStatus()
                kwargs.update({"uuid": client.uuid, "rule_id": rule.id})
                find_channel_id_for_rule.apply_async(kwargs=kwargs)

                context = {"uuid": client.uuid}
                return Response(context, status=202)

            trigger_sentry_app_action_creators_for_issues(actions=kwargs.get("actions"))

            if rule.data["conditions"] != kwargs["conditions"]:
                metrics.incr("sentry.issue_alert.conditions.edited", sample_rate=1.0)
            updated_rule = project_rules.Updater.run(rule=rule, request=request, **kwargs)

            RuleActivity.objects.create(
                rule=updated_rule, user_id=request.user.id, type=RuleActivityType.UPDATED.value
            )
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=updated_rule.id,
                event=audit_log.get_event_id("RULE_EDIT"),
                data=updated_rule.get_audit_log_data(),
            )
            alert_rule_edited.send_robust(
                user=request.user,
                project=project,
                rule=rule,
                rule_type="issue",
                sender=self,
                is_api_token=request.auth is not None,
            )

            return Response(serialize(updated_rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @transaction_start("ProjectRuleDetailsEndpoint")
    def delete(self, request: Request, project, rule) -> Response:
        """
        Delete a rule
        """
        rule.update(status=RuleStatus.PENDING_DELETION)
        RuleActivity.objects.create(
            rule=rule, user_id=request.user.id, type=RuleActivityType.DELETED.value
        )
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_REMOVE"),
            data=rule.get_audit_log_data(),
        )
        return Response(status=202)
