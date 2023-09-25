from datetime import datetime, timedelta, timezone
from typing import cast

from django.db import DatabaseError
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.event_search import parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.models import CustomDynamicSamplingRule, TooManyRules
from sentry.models.dynamicsampling import CUSTOM_RULE_DATE_FORMAT
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.metrics.extraction import SearchQueryConverter
from sentry.utils import json
from sentry.utils.dates import parse_stats_period

MAX_RULE_PERIOD_STRING = "6h"
MAX_RULE_PERIOD = parse_stats_period(MAX_RULE_PERIOD_STRING)
DEFAULT_PERIOD_STRING = "1h"
# the number of samples to collect per custom rule
NUM_SAMPLES_PER_CUSTOM_RULE = 100


class CustomRulesInputSerializer(serializers.Serializer):
    """
    Request data serializer
    """

    # the query string in the same format as the Discover query
    query = serializers.CharField(required=True)
    # desired time period for collection (it may be overriden if too long)
    period = serializers.CharField(required=False)
    # list of project ids to collect data from
    projects = serializers.ListField(child=serializers.IntegerField(), required=False)

    def validate(self, data):
        """
        Optional fields cannot be validated with validate_<FIELD_NAME> so we need to do it here for the
        `period` & 'projects' & overrideExisting fields
        """
        if data.get("projects") is None:
            data["projects"] = []

        # check that the project exists
        invalid_projects = []

        for project_id in data["projects"]:
            try:
                Project.objects.get_from_cache(id=project_id)
            except Project.DoesNotExist:
                invalid_projects.append(f"invalid project id: {project_id}")

        if invalid_projects:
            raise serializers.ValidationError({"projects": invalid_projects})

        period = data.get("period")
        if period is None:
            data["period"] = DEFAULT_PERIOD_STRING
        else:
            try:
                period = parse_stats_period(period)
            except OverflowError:
                data["period"] = MAX_RULE_PERIOD_STRING
            if period is None:
                raise serializers.ValidationError("Invalid period")
            if period > MAX_RULE_PERIOD:
                # limit the expiry period
                data["period"] = MAX_RULE_PERIOD_STRING
        return data


@region_silo_endpoint
class CustomRulesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def post(self, request: Request, organization: Organization) -> Response:

        if not features.has("organizations:investigation-bias", organization, actor=request.user):
            return Response(status=404)

        serializer = CustomRulesInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        query = serializer.validated_data["query"]
        projects = serializer.validated_data.get("projects")
        period = serializer.validated_data.get("period")

        try:
            tokens = parse_search_query(query)
        except InvalidSearchQuery as e:
            return Response({"query": [str(e)]}, status=400)

        try:
            converter = SearchQueryConverter(tokens)
            condition = converter.convert()

            # the parsing must succeed (it passed validation)
            delta = cast(timedelta, parse_stats_period(period))
            now = datetime.now(tz=timezone.utc)
            start = now
            end = now + delta

            rule = CustomDynamicSamplingRule.update_or_create(
                condition=condition,
                start=start,
                end=end,
                project_ids=projects,
                organization_id=organization.id,
                num_samples=NUM_SAMPLES_PER_CUSTOM_RULE,
                sample_rate=1.0,
            )

            response_data = {
                "ruleId": rule.external_rule_id,
                "condition": json.loads(rule.condition),
                "startDate": rule.start_date.strftime(CUSTOM_RULE_DATE_FORMAT),
                "endDate": rule.end_date.strftime(CUSTOM_RULE_DATE_FORMAT),
                "numSamples": rule.num_samples,
                "sampleRate": rule.sample_rate,
                "dateAdded": rule.date_added.strftime(CUSTOM_RULE_DATE_FORMAT),
                "projects": [project.id for project in rule.projects.all()],
                "orgId": rule.organization_id,
            }
            return Response(response_data, status=200)

        except DatabaseError:
            return Response(
                {"projects": ["Could not save rule, probably wrong project ids"]}, status=400
            )
        except TooManyRules:
            return Response(
                {
                    "error": [
                        "Too many investigation rules active for this organization."
                        "Wait until some expire or delete some rules."
                    ]
                },
                status=429,
            )
        except ValueError as e:
            return Response({"query": ["Could not convert to rule", str(e)]}, status=400)
