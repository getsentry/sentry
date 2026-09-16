from typing import NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.api.event_search import SearchConfig
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.serializers.models.groupsearchview import GroupSearchViewTimeFilters
from sentry.api.serializers.rest_framework import ValidationError
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.exceptions import InvalidSearchQuery
from sentry.issues.issue_search import issue_search_config, parse_search_query
from sentry.models.project import Project
from sentry.models.savedsearch import SORT_LITERALS, SortOptions

MAX_VIEWS = 50

# `InvalidSearchQuery` carries authored, user-facing copy built from the query itself
# ("Parse error at '...' (column 12).", "Empty string after 'assigned:'"), never a
# traceback or an internal path -- so echoing it is safe and is what the issues
# endpoint already does in `api/helpers/group_index/index.py`. CodeQL's
# `py/stack-trace-exposure` alert on this is a false positive.
LIST_FORM_HINT = (
    "To match any of several values, use the list form instead, e.g. issue:[PROJ-AB1, PROJ-CD2]."
)

# Identical to the issue search config except that boolean operators parse instead of
# raising, so a successful parse here isolates the boolean restriction as the cause.
_boolean_permissive_config = SearchConfig.create_from(issue_search_config, allow_boolean=True)


def _invalid_query_detail(value: str, exc: InvalidSearchQuery) -> str:
    """Lead with the parser's own reason, and name the fix when AND/OR is the problem."""
    detail = f"Invalid issue search query: {exc}"
    try:
        base_parse_search_query(value, config=_boolean_permissive_config)
    except InvalidSearchQuery:
        # Fails with booleans allowed too, so the boolean restriction is not the cause.
        return detail
    return f"{detail} {LIST_FORM_HINT}"


class GroupSearchViewTimeFiltersSerializer(serializers.Serializer):
    start = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The start of the time range in ISO-8601 format.",
    )
    end = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The end of the time range in ISO-8601 format.",
    )
    period = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The relative time period, such as `14d`.",
    )
    utc = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Whether to interpret the time range as UTC.",
    )


@extend_schema_field(GroupSearchViewTimeFiltersSerializer)
class GroupSearchViewTimeFiltersField(serializers.DictField):
    pass


class GroupSearchViewValidatorResponse(TypedDict):
    id: NotRequired[str]
    name: str
    query: str
    querySort: SORT_LITERALS
    position: int
    projects: list[int]
    isAllProjects: NotRequired[bool]
    environments: list[str]
    timeFilters: GroupSearchViewTimeFilters
    dateCreated: str | None
    dateUpdated: str | None


class ViewValidator(serializers.Serializer):
    id = serializers.CharField(required=False, help_text="The ID of the issue view.")
    name = serializers.CharField(required=True, help_text="The name of the issue view.")
    query = serializers.CharField(
        required=True,
        allow_blank=True,
        help_text=(
            "The issue search query. Issue search does not support the `AND`/`OR` boolean "
            "operators or parenthesized boolean groups. To match any of several values, use "
            "the list form instead: `issue:[PROJ-AB1, PROJ-CD2]`, `issue.priority:[high, medium]`."
        ),
    )
    querySort = serializers.ChoiceField(
        required=False,
        choices=SortOptions.as_choices(),
        default=SortOptions.DATE,
        help_text="How to sort issues in the view.",
    )

    projects = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=True,
        help_text="The project IDs included in the view. Use `-1` to include all projects.",
    )
    environments = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        allow_empty=True,
        help_text=(
            "The environment names included in the view. An empty list includes all environments."
        ),
    )
    timeFilters = GroupSearchViewTimeFiltersField(
        required=True,
        allow_empty=False,
        help_text="The time range for the view.",
    )

    def validate_query(self, value: str) -> str:
        # The view is stored verbatim and only parsed when someone opens it, so an
        # unparseable query saves fine and then 400s at read time. Parse here so the
        # write fails during validation instead.
        try:
            parse_search_query(value)
        except InvalidSearchQuery as e:
            raise ValidationError(detail=_invalid_query_detail(value, e))
        return value

    def validate_projects(self, value):
        if value != [-1]:
            project_ids = set(value)
            existing_project_ids = set(
                Project.objects.filter(
                    id__in=project_ids,
                    organization=self.context["organization"],
                ).values_list("id", flat=True)
            )

            if project_ids != existing_project_ids:
                raise ValidationError(detail="One or more projects do not exist")

        return value

    def validate(self, data) -> GroupSearchViewValidatorResponse:
        if data["projects"] == [-1]:
            data["projects"] = []
            data["isAllProjects"] = True
        else:
            data["isAllProjects"] = False
        return data


@sentry_schema_serializer(
    omit_from_public_schema={
        "id": "Inherited from ViewValidator for updates; the server assigns the id on create.",
    }
)
class GroupSearchViewPostValidator(ViewValidator):
    starred = serializers.BooleanField(
        required=False, help_text="Whether to star the issue view for the current user."
    )

    def validate(self, data):
        return super().validate(data)
