from datetime import datetime

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
    SerializedRule,
    custom_rules_redis_key,
    get_rule_hash,
    rule_from_json,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.snuba.metrics.extraction import SearchQueryConverter
from sentry.utils import json
from sentry.utils.dates import parse_stats_period

MAX_RULE_PERIOD_STRING = "6h"
MAX_RULE_PERIOD = parse_stats_period(MAX_RULE_PERIOD_STRING)
DEFAULT_PERIOD_STRING = "1h"


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
    # should this request override an existing rule if one with the same query & projects already exists ?
    # if false and a rule exists the request will fail with a 409 (Conflict) status code
    # if true and a rule exists the request will override the existing rule's period
    overrideExisting = serializers.BooleanField(required=False)

    def validate(self, data):
        """
        Optional fields cannot be validated with validate_<FIELD_NAME> so we need to do it here for the
        `period` & 'projects' & overrideExisting fields
        """
        if data.get("projects") is None:
            data["projects"] = []

        if data.get("overrideExisting") is None:
            data["overrideExisting"] = False

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
        override_existing = serializer.validated_data.get("overrideExisting")
        period = serializer.validated_data.get("period")

        try:
            tokens = parse_search_query(query)
        except InvalidSearchQuery as e:
            return Response({"query": [str(e)]}, status=400)

        try:
            converter = SearchQueryConverter(tokens)
            condition = converter.convert()

            timedelta = parse_stats_period(period)
            expiration = (datetime.utcnow() + timedelta).timestamp()

            rule = SerializedRule(
                condition=condition,
                expiration=expiration,
                project_ids=projects,
                org_id=organization.id,
            )

            _save_rule(rule, override_existing)

        except RuleExistsError:
            return Response({"query": ["Rule already exists"]}, status=409)

        except ValueError as e:
            return Response({"query": ["Could not convert to rule", str(e)]}, status=400)

        return Response(rule, status=200)


def _save_rule(rule: SerializedRule, override_existing: bool):
    """
    Saves a custom rule in the Redis hash for the organization
    """

    key = custom_rules_redis_key(rule["org_id"])
    hash_val = get_rule_hash(rule)

    redis_client = get_redis_client_for_ds()

    if rule["expiration"] < datetime.utcnow().timestamp():
        raise ValueError("Rule has already expired")

    if not override_existing:
        value = redis_client.hget(key, hash_val)
        if value is not None:
            existing_rule = rule_from_json(value)
            if existing_rule["expiration"] > datetime.utcnow().timestamp():
                # we have an existing rule that hasn't expired give up
                raise RuleExistsError()

    redis_client.hset(key, hash_val, json.dumps(rule))
