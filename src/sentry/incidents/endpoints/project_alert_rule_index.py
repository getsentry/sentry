from __future__ import absolute_import

from copy import deepcopy

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule
from sentry.incidents.endpoints.serializers import AlertRuleSerializer


class ProjectAlertRuleIndexEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        Fetches alert rules for a project
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        return self.paginate(
            request,
            queryset=AlertRule.objects.fetch_for_project(project),
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request, project):
        """
        Create an alert rule
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        data = deepcopy(request.data)
        trigger_data = data["triggers"]
        print ("data is:", data)
        print ("trigger_data is:", trigger_data)

        data["projects"] = [project.slug]

        rule_serializer = AlertRuleSerializer(
            context={"organization": project.organization, "access": request.access}, data=data
        )
        if serializer.is_valid():
            alert_rule = alert_rule_serializer.save()
            trigger_serializer = AlertRuleTriggerSerializer(
                context={
                    "organization": project.organization,
                    "alert_rule": alert_rule,
                    "access": request.access,
                },
                data=request.data,
            )
            if serializer.is_valid():
                trigger = serializer.save()
                action_serializer = AlertRuleTriggerActionSerializer(
                    context={
                        "organization": organization,
                        "alert_rule": alert_rule,
                        "trigger": alert_rule_trigger,
                        "access": request.access,
                    },
                    data=request.data,
                )

                if serializer.is_valid():
                    try:
                        action = serializer.save()
                    except InvalidTriggerActionError as e:
                        return Response(e.message, status=status.HTTP_400_BAD_REQUEST)
                    return Response(serialize(action, request.user), status=status.HTTP_201_CREATED)

                return Response(serialize(trigger, request.user), status=status.HTTP_201_CREATED)

            return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
