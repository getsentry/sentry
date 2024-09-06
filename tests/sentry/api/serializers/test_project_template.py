from collections.abc import Mapping
from typing import Any

from sentry.api.serializers.models.project_template import (
    ProjectTemplateAttributes,
    ProjectTemplateSerializer,
)
from sentry.models.options.project_template_option import ProjectTemplateOption
from sentry.testutils.cases import TestCase


class ProjectTemplateSerializerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()

        self.organization = self.create_organization()
        self.project_template = self.create_project_template(organization=self.organization)
        self.option = ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="key1", value="value1"
        )

    def test_serialize(self):
        serializer = ProjectTemplateSerializer()
        result = serializer.serialize(self.project_template, {}, self.user)

        assert result == {
            "id": self.project_template.id,
            "name": self.project_template.name,
            "createdAt": self.project_template.date_added,
            "updatedAt": self.project_template.date_updated,
        }

    def test_serialize__expand_options(self):
        serializer = ProjectTemplateSerializer(expand=[ProjectTemplateAttributes.OPTIONS])
        attrs: Mapping[str, Any] = {
            ProjectTemplateAttributes.OPTIONS: {
                "key1": "value1",
            }
        }

        result = serializer.serialize(self.project_template, attrs, self.user)

        assert result == {
            "id": self.project_template.id,
            "name": self.project_template.name,
            "createdAt": self.project_template.date_added,
            "updatedAt": self.project_template.date_updated,
            "options": {"key1": "value1"},
        }

    def test_get_attrs(self):
        serializer = ProjectTemplateSerializer(expand=[ProjectTemplateAttributes.OPTIONS])
        result = serializer.get_attrs([self.project_template], self.user)

        assert result == {
            self.project_template: {
                ProjectTemplateAttributes.OPTIONS: {
                    "key1": "value1",
                },
            },
        }

    def test_get_attrs__without_options(self):
        serializer = ProjectTemplateSerializer()
        result = serializer.get_attrs([self.project_template], self.user)

        assert result == {
            self.project_template: {},
        }

    # other checks like looking at more attributes are validated with types
    def test_expand(self):
        serializer = ProjectTemplateSerializer(expand=[ProjectTemplateAttributes.OPTIONS])
        assert serializer._expand(ProjectTemplateAttributes.OPTIONS) is True

    def test_expand__without_being_set(self):
        serializer = ProjectTemplateSerializer(expand=[])
        assert serializer._expand(ProjectTemplateAttributes.OPTIONS) is False
