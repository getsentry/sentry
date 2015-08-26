from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import RuleSerializer
from sentry.models import Rule


class ProjectRuleDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, rule_id):
        """
        Retrieve a rule

        Return details on an individual rule.

            {method} {path}

        """
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
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
            'actionMatch': rule.data.get('action_match', 'all'),
        }, context={'project': project}, data=request.DATA, partial=True)

        if serializer.is_valid():
            rule = serializer.save(rule=rule)

            return Response(serialize(rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
