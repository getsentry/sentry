from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import RuleSerializer
from sentry.models import AuditLogEntryEvent, Rule, RuleStatus


class ProjectRulesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's rules

        Retrieve a list of rules for a given project.

            {method} {path}

        """
        queryset = Rule.objects.filter(
            project=project,
            status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE],
        ).select_related('project')

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
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
        serializer = RuleSerializer(
            context={'project': project},
            data=request.DATA,
        )

        if serializer.is_valid():
            rule = serializer.save(rule=Rule())
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=rule.id,
                event=AuditLogEntryEvent.RULE_ADD,
                data=rule.get_audit_log_data(),
            )

            return Response(serialize(rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
