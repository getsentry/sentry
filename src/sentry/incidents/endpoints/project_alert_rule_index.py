from __future__ import absolute_import

import six
import time
from datetime import datetime
from copy import deepcopy

from rest_framework import status
from rest_framework.response import Response

from django.utils import timezone

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize, CombinedRuleSerializer
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.incidents.models import AlertRule
from sentry.models import Rule, RuleStatus
from sentry.utils.cursors import build_cursor, Cursor


class ProjectCombinedRuleIndexEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        Fetches alert rules and legacy rules for an organization
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        cursor_string = request.GET.get(
            "cursor", six.binary_type(int(time.time() * 1000000)) + ":0:0"
        )
        try:
            limit = min(100, int(request.GET.get("limit", 25)))
        except ValueError as e:
            return Response(
                {"detail": "Invalid input for `limit`. Error: %s" % six.text_type(e)}, status=400
            )

        cursor = Cursor.from_string(cursor_string)
        cursor_date = datetime.fromtimestamp(float(cursor.value) / 1000000).replace(
            tzinfo=timezone.utc
        )

        alert_rule_queryset = (
            AlertRule.objects.fetch_for_project(project)
            .filter(date_added__lte=cursor_date)
            .order_by("-date_added")[: limit + 1]
        )

        legacy_rule_queryset = (
            Rule.objects.filter(
                project=project, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
            )
            .select_related("project")
            .filter(date_added__lte=cursor_date)
            .order_by("-date_added")[: (limit + 1)]
        )
        combined_rules = list(alert_rule_queryset) + list(legacy_rule_queryset)
        combined_rules.sort(
            key=lambda instance: (instance.date_added, type(instance)), reverse=True
        )
        combined_rules = combined_rules[cursor.offset : cursor.offset + limit + 1]

        def get_item_key(item, for_prev=False):
            return 1000000 * float(item.date_added.strftime("%s.%f"))

        cursor_result = build_cursor(
            results=combined_rules, cursor=cursor, key=get_item_key, limit=limit, is_desc=True
        )
        results = list(cursor_result)
        context = serialize(results, request.user, CombinedRuleSerializer())
        response = Response(context)
        self.add_cursor_headers(request, response, cursor_result)
        return response


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
        data["projects"] = [project.slug]
        serializer = AlertRuleSerializer(
            context={"organization": project.organization, "access": request.access}, data=data
        )

        if serializer.is_valid():
            alert_rule = serializer.save()
            return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
