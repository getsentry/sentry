from typing import NotRequired, TypedDict

from rest_framework import serializers

from sentry.models.savedsearch import SORT_LITERALS, SortOptions

MAX_VIEWS = 50


class GroupSearchViewValidatorResponse(TypedDict):
    id: NotRequired[str]
    name: str
    query: str
    querySort: SORT_LITERALS
    position: int
    dateCreated: str | None
    dateUpdated: str | None


class ViewValidator(serializers.Serializer):
    id = serializers.CharField(required=False)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, allow_blank=True)
    querySort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )


class GroupSearchViewValidator(serializers.Serializer):
    views = serializers.ListField(
        child=ViewValidator(), required=True, min_length=1, max_length=MAX_VIEWS
    )

    def validate(self, data):
        return data
