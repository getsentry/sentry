from __future__ import absolute_import

from uuid import uuid4

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.models import AuditLogEntryEvent, Rule, RuleStatus

from sentry.integrations.slack import tasks
from sentry.mediators import project_rules


class ProjectRuleDetailsEndpoint(ProjectEndpoint):
    permission_classes = [ProjectSettingPermission]

    def get(self, request, project, rule_id):
        """
        Retrieve a rule

        Return details on an individual rule.

            {method} {path}

        """
        rule = Rule.objects.get(
            project=project, id=rule_id, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
        )
        return Response(serialize(rule, request.user))

    def put(self, request, project, rule_id):
        """
        Update a rule

        Update various attributes for the given rule.

            {method} {path}
            {{
              "name": "My rule name",
              "conditions": [],
              "actions": [],
              "actionMatch": "all"
            }}

        """
        rule = Rule.objects.get(project=project, id=rule_id)

        serializer = RuleSerializer(context={"project": project}, data=request.data, partial=True)

        if serializer.is_valid():
            data = serializer.validated_data
            kwargs = {
                "name": data["name"],
                "environment": data.get("environment", None),
                "project": project,
                "action_match": data["actionMatch"],
                "conditions": data["conditions"],
                "actions": data["actions"],
                "frequency": data["frequency"],
            }

            updated_rule = project_rules.Updater.run(
                rule=rule, pending_save=data.get("pending_save", False), request=request, **kwargs
            )

            if not updated_rule:
                uuid = uuid4().hex
                kwargs.update({"uuid": uuid, "rule_id": rule.id})
                tasks.find_channel_id_for_rule.apply_async(kwargs=kwargs)
                context = {"uuid": uuid}
                return Response(context, status=202)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=updated_rule.id,
                event=AuditLogEntryEvent.RULE_EDIT,
                data=updated_rule.get_audit_log_data(),
            )

            return Response(serialize(updated_rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, project, rule_id):
        """
        Delete a rule
        """
        rule = Rule.objects.get(
            project=project, id=rule_id, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
        )

        rule.update(status=RuleStatus.PENDING_DELETION)
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=AuditLogEntryEvent.RULE_REMOVE,
            data=rule.get_audit_log_data(),
        )
        return Response(status=202)
