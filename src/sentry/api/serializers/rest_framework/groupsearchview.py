from typing import Any, NotRequired, TypedDict

from rest_framework import serializers

from sentry import features
from sentry.api.serializers.rest_framework import ValidationError
from sentry.models.project import Project
from sentry.models.savedsearch import SORT_LITERALS, SortOptions

MAX_VIEWS = 50


class GroupSearchViewValidatorResponse(TypedDict):
    id: NotRequired[str]
    name: str
    query: str
    querySort: SORT_LITERALS
    position: int
    projects: list[int]
    isAllProjects: NotRequired[bool]
    environments: list[str]
    timeFilters: dict[str, Any]
    dateCreated: str | None
    dateUpdated: str | None


class ViewValidator(serializers.Serializer):
    id = serializers.CharField(required=False)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, allow_blank=True)
    querySort = serializers.ChoiceField(
        required=False, choices=SortOptions.as_choices(), default=SortOptions.DATE
    )

    projects = serializers.ListField(required=True, allow_empty=True)
    environments = serializers.ListField(required=True, allow_empty=True)
    timeFilters = serializers.DictField(required=True, allow_empty=False)

    def validate_projects(self, value):
        if not features.has("organizations:global-views", self.context["organization"]) and (
            value == [-1] or value == [] or len(value) > 1
        ):
            raise ValidationError(detail="You do not have the multi project stream feature enabled")

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


class GroupSearchViewPostValidator(ViewValidator):
    starred = serializers.BooleanField(required=False)

    def validate(self, data):
        return super().validate(data)
