from __future__ import absolute_import

from copy import deepcopy

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import (
    OffsetPaginator,
    CombinedQuerysetPaginator,
    CombinedQuerysetIntermediary,
)
from sentry.api.serializers import serialize, CombinedRuleSerializer
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.incidents.models import AlertRule
from sentry.signals import alert_rule_created
from sentry.snuba.dataset import Dataset
from sentry.models import Rule, RuleStatus


class ProjectCombinedRuleIndexEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        Fetches alert rules and legacy rules for a project
        """
        alert_rules = AlertRule.objects.fetch_for_project(project)
        if not features.has("organizations:performance-view", project.organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        alert_rule_intermediary = CombinedQuerysetIntermediary(alert_rules, "date_added")
        rule_intermediary = CombinedQuerysetIntermediary(
            Rule.objects.filter(
                project=project, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
            ),
            "date_added",
        )

        return self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer()),
            default_per_page=25,
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )


class ProjectAlertRuleIndexEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        Fetches alert rules for a project
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        alert_rules = AlertRule.objects.fetch_for_project(project)
        if not features.has("organizations:performance-view", project.organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        return self.paginate(
            request,
            queryset=alert_rules,
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
        data["projects"] = [project.slug]

        serializer = AlertRuleSerializer(
            context={
                "organization": project.organization,
                "access": request.access,
                "user": request.user,
            },
            data=data,
        )

        if serializer.is_valid():
            alert_rule = serializer.save()
            referrer = request.query_params.get("referrer")
            session_id = request.query_params.get("sessionId")
            alert_rule_created.send_robust(
                user=request.user,
                project=project,
                rule=alert_rule,
                rule_type="metric",
                sender=self,
                referrer=referrer,
                session_id=session_id,
            )
            return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
