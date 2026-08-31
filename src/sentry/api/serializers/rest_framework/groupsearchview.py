from typing import NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from sentry.api.serializers.models.groupsearchview import GroupSearchViewTimeFilters
from sentry.api.serializers.rest_framework import ValidationError
from sentry.models.project import Project
from sentry.models.savedsearch import SORT_LITERALS, SortOptions

MAX_VIEWS = 50


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
        required=True, allow_blank=True, help_text="The issue search query."
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


@extend_schema_serializer(exclude_fields=["id"])
class GroupSearchViewPostValidator(ViewValidator):
    starred = serializers.BooleanField(
        required=False, help_text="Whether to star the issue view for the current user."
    )

    def validate(self, data):
        return super().validate(data)
