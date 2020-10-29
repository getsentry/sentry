from __future__ import absolute_import


from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import RuleSerializer
from sentry.integrations.slack import tasks
from sentry.mediators import project_rules
from sentry.models import AuditLogEntryEvent, Rule, RuleActivity, RuleActivityType, RuleStatus
from sentry.signals import alert_rule_created
from sentry.web.decorators import transaction_start


class ProjectRulesEndpoint(ProjectEndpoint):
    @transaction_start("ProjectRulesEndpoint")
    def get(self, request, project):
        """
        List a project's rules

        Retrieve a list of rules for a given project.

            {method} {path}

        """
        queryset = Rule.objects.filter(
            project=project, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
        ).select_related("project")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            on_results=lambda x: serialize(x, request.user),
        )

    @transaction_start("ProjectRulesEndpoint")
    def post(self, request, project):
        """
        Create a rule

        Create a new rule for the given project.

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
        serializer = RuleSerializer(context={"project": project}, data=request.data)

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

            if data.get("pending_save"):
                client = tasks.RedisRuleStatus()
                uuid_context = {"uuid": client.uuid}
                kwargs.update(uuid_context)
                tasks.find_channel_id_for_rule.apply_async(kwargs=kwargs)
                return Response(uuid_context, status=202)

            rule = project_rules.Creator.run(request=request, **kwargs)
            RuleActivity.objects.create(
                rule=rule, user=request.user, type=RuleActivityType.CREATED.value
            )
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=rule.id,
                event=AuditLogEntryEvent.RULE_ADD,
                data=rule.get_audit_log_data(),
            )
            alert_rule_created.send_robust(
                user=request.user, project=project, rule=rule, rule_type="issue", sender=self
            )

            return Response(serialize(rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
