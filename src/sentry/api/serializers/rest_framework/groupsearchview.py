from typing import Any, NotRequired, TypedDict

from rest_framework import serializers

from sentry.models.savedsearch import SORT_LITERALS, SortOptions

MAX_VIEWS = 50


class GroupSearchViewValidatorResponse(TypedDict):
    id: NotRequired[str]
    name: str
    query: str
    querySort: SORT_LITERALS
    position: int
    projects: NotRequired[list[int]]
    isAllProjects: NotRequired[bool]
    environments: NotRequired[list[str]]
    timeFilters: NotRequired[dict[str, Any]]
    dateCreated: str | None
    dateUpdated: str | None


class ViewValidator(serializers.Serializer):
    id = serializers.CharField(required=False)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, allow_blank=True)
    querySort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )
    # TODO(msun): Once frontend is updated, make these fields required
    projects = serializers.ListField(required=False, allow_empty=True)
    environments = serializers.ListField(required=False, allow_empty=True)
    timeFilters = serializers.DictField(
        required=False,
        allow_empty=True,
    )
    isAllProjects = serializers.BooleanField(required=False)

    def validate_timeFilters(self, value):
        # Replace empty dict or None with default time filter
        if not value:
            return {"period": "14d"}
        return value


class GroupSearchViewValidator(serializers.Serializer):
    views = serializers.ListField(
        child=ViewValidator(), required=True, min_length=1, max_length=MAX_VIEWS
    )

    def validate(self, data):
        return data
