from unittest.mock import Mock

import pytest
from rest_framework import serializers

from sentry.api.serializers.rest_framework.list import EmptyListField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.testutils.cases import TestCase


class ProjectFieldTest(TestCase):
    def test_id_allowed_accepts_project_id(self) -> None:
        project = self.create_project()
        access = Mock()
        access.has_any_project_scope.return_value = True

        class ProjectSerializer(serializers.Serializer):
            project = ProjectField(scope="project:read", id_allowed=True)

        serializer = ProjectSerializer(
            data={"project": str(project.id)},
            context={"organization": project.organization, "access": access},
        )

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["project"] == project

    def test_default_rejects_project_id(self) -> None:
        project = self.create_project()
        access = Mock()
        access.has_any_project_scope.return_value = True

        class ProjectSerializer(serializers.Serializer):
            project = ProjectField(scope="project:read")

        serializer = ProjectSerializer(
            data={"project": str(project.id)},
            context={"organization": project.organization, "access": access},
        )

        assert not serializer.is_valid()
        assert serializer.errors == {"project": ["Invalid project"]}


class EmptyListFieldTest(TestCase):
    def test_empty_string_is_an_empty_list(self) -> None:
        field = EmptyListField(child=serializers.CharField(allow_blank=True))

        assert field.to_internal_value("") == []

    def test_default_child_preserves_arbitrary_items(self) -> None:
        field = EmptyListField()

        assert field.to_internal_value([1, "value"]) == [1, "value"]

    def test_integer_child_converts_values(self) -> None:
        field = EmptyListField(child=serializers.IntegerField())

        assert field.to_internal_value(["1"]) == [1]

    def test_string_child_validates_values(self) -> None:
        field = EmptyListField(child=serializers.CharField())

        assert field.to_internal_value([1]) == ["1"]

    def test_invalid_values_keep_list_field_validation(self) -> None:
        field = EmptyListField(child=serializers.IntegerField())

        with pytest.raises(serializers.ValidationError):
            field.to_internal_value(["invalid"])

        with pytest.raises(serializers.ValidationError):
            field.to_internal_value("invalid")
