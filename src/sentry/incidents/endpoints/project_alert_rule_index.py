from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.endpoints.serializers import AlertRuleSerializer


class ProjectAlertRuleIndexEndpoint(ProjectEndpoint):
    def post(self, request, project):
        """
        Create an alert rule
        """
        if not features.has('organizations:incidents', project.organization, actor=request.user):
            raise ResourceDoesNotExist

        serializer = AlertRuleSerializer(
            context={'project': project},
            data=request.data,
        )

        if serializer.is_valid():
            alert_rule = serializer.save()
            # TODO: Implement serializer
            return Response({'id': alert_rule.id}, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
