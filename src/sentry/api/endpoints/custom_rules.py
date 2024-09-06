from datetime import datetime, timedelta, timezone
from enum import Enum

import orjson
import sentry_sdk
from django.db import DatabaseError
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.exceptions import InvalidSearchQuery
from sentry.models.dynamicsampling import (
    CUSTOM_RULE_DATE_FORMAT,
    CustomDynamicSamplingRule,
    TooManyRules,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.types import RuleCondition
from sentry.snuba.metrics.extraction import SearchQueryConverter, parse_search_query
from sentry.tasks.relay import schedule_invalidate_project_config

# the number of samples to collect per custom rule
NUM_SAMPLES_PER_CUSTOM_RULE = 100


class UnsupportedSearchQueryReason(Enum):
    # we only support transaction queries
    NOT_TRANSACTION_QUERY = "not_transaction_query"


class UnsupportedSearchQuery(Exception):
    def __init__(self, error_code: UnsupportedSearchQueryReason, *args, **kwargs):
        super().__init__(error_code.value, *args, **kwargs)
        self.error_code = error_code.value


class CustomRulesInputSerializer(serializers.Serializer):
    """
    Request data serializer
    """

    # the query string in the same format as the Discover query
    query = serializers.CharField(required=False, allow_blank=True)
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

        data["projects"] = _clean_project_list(data["projects"])
        requested_projects = data["projects"]

        available_projects = {p.id for p in Project.objects.get_many_from_cache(data["projects"])}
        for project_id in requested_projects:
            if project_id not in available_projects:
                invalid_projects.append(f"invalid project id: {project_id}")

        if invalid_projects:
            raise serializers.ValidationError({"projects": invalid_projects})

        return data


class CustomRulePermission(OrganizationPermission):
    scope_map = {
        "GET": [
            "org:read",
            "org:write",
            "org:admin",
            "project:read",
            "project:write",
            "project:admin",
        ],
        "POST": [
            "org:read",
            "org:write",
            "org:admin",
            "project:read",
            "project:write",
            "project:admin",
        ],
    }


@region_silo_endpoint
class CustomRulesEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (CustomRulePermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = CustomRulesInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        query = serializer.validated_data["query"]
        project_ids = serializer.validated_data.get("projects")

        # project-level permission check
        self.get_projects(request, organization, project_ids=set(project_ids))

        try:
            condition = get_rule_condition(query)

            # for now delta it is fixed at 2 days (maybe in the future will base it on the query period)
            delta = timedelta(days=2)
            now = datetime.now(tz=timezone.utc)
            start = now
            end = now + delta

            rule = CustomDynamicSamplingRule.update_or_create(
                condition=condition,
                start=start,
                end=end,
                project_ids=project_ids,
                organization_id=organization.id,
                num_samples=NUM_SAMPLES_PER_CUSTOM_RULE,
                sample_rate=1.0,
                query=query,
                created_by_id=request.user.id,
            )

            # schedule update for affected project configs
            _schedule_invalidate_project_configs(organization, project_ids)

            return _rule_to_response(rule)
        except UnsupportedSearchQuery as e:
            return Response({"query": [e.error_code]}, status=400)
        except InvalidSearchQuery as e:
            return Response({"query": [str(e)]}, status=400)

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

    def get(self, request: Request, organization: Organization) -> Response:
        requested_projects = request.GET.getlist("project")
        query = request.GET.get("query")

        try:
            requested_projects_ids = [int(project_id) for project_id in requested_projects]
            requested_projects_ids = _clean_project_list(requested_projects_ids)
        except ValueError:
            return Response({"projects": ["Invalid project id"]}, status=400)

        # project-level permission check
        self.get_projects(request, organization, project_ids=set(requested_projects_ids))

        if requested_projects_ids:
            org_rule = False
            invalid_projects = []
            available_projects = {
                p.id for p in Project.objects.get_many_from_cache(requested_projects_ids)
            }
            for project_id in requested_projects_ids:
                if project_id not in available_projects:
                    invalid_projects.append(f"invalid project id: {project_id}")

            if invalid_projects:
                raise serializers.ValidationError({"projects": invalid_projects})
        else:
            # no project specified (it is an org rule)
            org_rule = True

        try:
            condition = get_rule_condition(query)
        except UnsupportedSearchQuery as e:
            return Response({"query": [e.error_code]}, status=400)
        except InvalidSearchQuery as e:
            return Response({"query": [str(e)]}, status=400)
        except ValueError as e:
            return Response({"query": ["Could not convert to rule", str(e)]}, status=400)

        rule = CustomDynamicSamplingRule.get_rule_for_org(
            condition, organization.id, requested_projects_ids
        )

        if rule is None:
            return Response(status=204)  # no rule found, nothing to return

        # we have a rule, check to see if the projects match

        if rule.is_org_level:
            # a rule org covers all projects
            return _rule_to_response(rule)

        if not rule.is_org_level and org_rule:
            # we need an org rule, and we have a simple rule return not found
            return Response(status=204)

        # project rule request and project rule found # see if we have all projects
        available_projects = {p.id for p in rule.projects.all()}
        for project_id in requested_projects_ids:
            if project_id not in available_projects:
                return Response(status=204)

        # the rule covers all projects
        return _rule_to_response(rule)


def _rule_to_response(rule: CustomDynamicSamplingRule) -> Response:
    response_data = {
        "ruleId": rule.external_rule_id,
        "condition": orjson.loads(rule.condition),
        "startDate": rule.start_date.strftime(CUSTOM_RULE_DATE_FORMAT),
        "endDate": rule.end_date.strftime(CUSTOM_RULE_DATE_FORMAT),
        "numSamples": rule.num_samples,
        "sampleRate": rule.sample_rate,
        "dateAdded": rule.date_added.strftime(CUSTOM_RULE_DATE_FORMAT),
        "projects": [project.id for project in rule.projects.all()],
        "orgId": rule.organization.id,
    }

    return Response(response_data, status=200)


def get_rule_condition(query: str | None) -> RuleCondition:
    """
    Gets the rule condition given a query.

    The rule returned, is in the format which is understood by Relay.
    """
    try:
        if not query:
            raise UnsupportedSearchQuery(UnsupportedSearchQueryReason.NOT_TRANSACTION_QUERY)

        try:
            # First we parse the query.
            tokens = parse_search_query(
                query=query, removed_blacklisted=True, force_transaction_event_type=True
            )
        except ValueError:
            raise UnsupportedSearchQuery(UnsupportedSearchQueryReason.NOT_TRANSACTION_QUERY)

        # In case there are no tokens anymore, we will return a condition that always matches.
        if not tokens:
            return {"op": "and", "inner": []}

        # Second we convert it to the Relay's internal rules format.
        converter = SearchQueryConverter(tokens)
        condition = converter.convert()

        return condition
    except UnsupportedSearchQuery as unsupported_ex:
        # log unsupported queries with a different message so that
        # we can differentiate them from other errors
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("query", query)
            scope.set_extra("error", unsupported_ex)
            message = "Unsupported search query"
            sentry_sdk.capture_message(message, level="warning")
        raise
    except Exception as ex:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("query", query)
            scope.set_extra("error", ex)
            message = "Could not convert query to custom dynamic sampling rule"
            sentry_sdk.capture_message(message, level="warning")
        raise


def _clean_project_list(project_ids: list[int]) -> list[int]:
    if len(project_ids) == 1 and project_ids[0] == -1:
        # special case for all projects convention ( sends a project id of -1)
        return []

    return project_ids


def _schedule_invalidate_project_configs(organization: Organization, project_ids: list[int]):
    """
    Schedule a task to update the project configs for the given projects
    """
    if not project_ids:
        # an organisation rule, update all projects from the org
        schedule_invalidate_project_config(
            trigger="dynamic_sampling:custom_rule_upsert",
            organization_id=organization.id,
        )
    else:
        # update the given projects
        for project_id in project_ids:
            schedule_invalidate_project_config(
                trigger="dynamic_sampling:custom_rule_upsert",
                project_id=project_id,
            )
