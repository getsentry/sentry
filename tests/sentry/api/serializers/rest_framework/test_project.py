from unittest.mock import Mock

from rest_framework import serializers

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
