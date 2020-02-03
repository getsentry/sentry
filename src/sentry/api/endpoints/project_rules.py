from __future__ import absolute_import

from uuid import uuid4

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import RuleSerializer
from sentry.models import AuditLogEntryEvent, Rule, RuleStatus
from sentry.signals import alert_rule_created

from sentry.integrations.slack import tasks
from sentry.mediators import project_rules


class ProjectRulesEndpoint(ProjectEndpoint):
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

    def post(self, request, project):
        """
        Create a rule

        Create a new rule for the given project.

            {method} {path}
            {{
              "name": "My rule name",
              "conditions": [],
              "actions": [],
              "actionMatch": "all"
            }}

        """
        serializer = RuleSerializer(context={"project": project}, data=request.data)

        if serializer.is_valid():
            data = serializer.validated_data
            kwargs = {
                "name": data["name"],
                "environment": data.get("environment"),
                "project": project,
                "action_match": data["actionMatch"],
                "conditions": data["conditions"],
                "actions": data["actions"],
                "frequency": data.get("frequency"),
            }

            rule = project_rules.Creator.run(
                pending_save=data.get("pending_save", False), request=request, **kwargs
            )

            if not rule:
                uuid = uuid4().hex
                kwargs.update({"uuid": uuid})
                tasks.find_channel_id_for_rule.apply_async(kwargs=kwargs)
                context = {"uuid": uuid}
                return Response(context, status=202)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=rule.id,
                event=AuditLogEntryEvent.RULE_ADD,
                data=rule.get_audit_log_data(),
            )
            alert_rule_created.send_robust(
                user=request.user, project=project, rule=rule, sender=self
            )

            return Response(serialize(rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
