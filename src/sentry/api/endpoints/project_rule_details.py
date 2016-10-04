from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import RuleSerializer
from sentry.models import AuditLogEntryEvent, Rule, RuleStatus


class ProjectRuleDetailsEndpoint(ProjectEndpoint):
    permission_classes = [ProjectSettingPermission]

    def get(self, request, project, rule_id):
        """
        Retrieve a rule

        Return details on an individual rule.

            {method} {path}

        """
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
            status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE],
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
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
        )
        serializer = RuleSerializer({
            'actionMatch': rule.data.get('action_match') or Rule.DEFAULT_ACTION_MATCH,
            'frequency': rule.data.get('frequency') or Rule.DEFAULT_FREQUENCY,
        }, context={'project': project}, data=request.DATA, partial=True)

        if serializer.is_valid():
            rule = serializer.save(rule=rule)
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=rule.id,
                event=AuditLogEntryEvent.RULE_EDIT,
                data=rule.get_audit_log_data(),
            )

            return Response(serialize(rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, project, rule_id):
        """
        Delete a rule
        """
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
            status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE],
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
