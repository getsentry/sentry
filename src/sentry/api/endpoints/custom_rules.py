from datetime import datetime, timedelta, timezone
from typing import cast

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.event_search import parse_search_query
from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.dynamic_sampling.rules.biases.custom_rule_bias import (
    SerializedCustomRule,
    custom_rules_redis_key,
    get_custom_rule_hash,
    get_custom_rule_id,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.snuba.metrics.extraction import SearchQueryConverter
from sentry.utils import json
from sentry.utils.dates import parse_stats_period

MAX_RULE_PERIOD_STRING = "6h"
MAX_RULE_PERIOD = parse_stats_period(MAX_RULE_PERIOD_STRING)
DEFAULT_PERIOD_STRING = "1h"
# the number of samples to collect per custom rule
NUM_SAMPLES_PER_CUSTOM_RULE = 100


class RuleExistsError(ValueError):
    """
    Raised when a rule already exists and overrideExisting is False
    """

    pass


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
            start = now.timestamp()
            expiration = (now + delta).timestamp()

            rule = SerializedCustomRule(
                condition=condition,
                expiration=expiration,
                start=start,
                project_ids=projects,
                org_id=organization.id,
                count=NUM_SAMPLES_PER_CUSTOM_RULE,
                rule_id=0,  # will be overriden when an id is assigned
            )

            # this may return an already saved rule
            saved_rule = _save_rule(rule)

        except RuleExistsError:
            return Response(
                {
                    "query": [
                        "Rule already exists, set `overrideExisting:true` if you want to override"
                    ]
                },
                status=409,
            )

        except ValueError as e:
            return Response({"query": ["Could not convert to rule", str(e)]}, status=400)

        return Response(saved_rule, status=200)


def _save_rule(rule: SerializedCustomRule) -> SerializedCustomRule:
    """
    Saves a custom rule in the Redis hash for the organization
    """

    if rule["expiration"] < datetime.utcnow().timestamp():
        raise ValueError("Rule has already expired")

    key = custom_rules_redis_key(rule["org_id"])

    redis_client = get_redis_client_for_ds()
    rule_hash = get_custom_rule_hash(rule)

    existing_rule_str = redis_client.hget(key, rule_hash)

    if existing_rule_str is not None:
        # we already have a rule for this condition no need to do anything
        existing_rule = json.loads(existing_rule_str) if existing_rule_str is not None else None
        return existing_rule

    rule_id = get_custom_rule_id(rule["org_id"])
    rule["rule_id"] = rule_id

    redis_client.hset(key, rule_hash, json.dumps(rule))
    return rule
