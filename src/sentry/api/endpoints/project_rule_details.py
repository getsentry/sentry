from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Rule


class ProjectRuleDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, rule_id):
        """
        Retrieve a rules

        Return details on an individual rule.

            {method} {path}

        """
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
        )
        return Response(serialize(rule, request.user))
