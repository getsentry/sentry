from typing import Any

import pytest

from fixtures.integrations.jira.stub_client import StubJiraApiClient
from sentry.integrations.jira.models.create_issue_metadata import (
    JIRA_CUSTOM_FIELD_TYPES,
    JiraField,
    JiraSchema,
    JiraSchemaTypes,
)
from sentry.integrations.jira.utils.create_issue_schema_transformers import transform_fields
from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.testutils.cases import TestCase


class TestDataTransformer(TestCase):
    def setUp(self):
        # TODO(Gabe): Add an interface for the Jira client to share among the different impls
        self.client: Any = StubJiraApiClient()

    def test_transform_with_empty_fields_set(self):
        transformed_data = transform_fields(
            self.client.user_id_field(),
            [],
            **{"field1": "abcd", "field2": "1234", "field3": "foobar"},
        )

        assert transformed_data == {}

    def create_standard_field(
        self,
        name: str,
        schema_type: JiraSchemaTypes,
        is_array: bool = False,
        key: str | None = None,
        required: bool = False,
    ) -> JiraField:
        if is_array:
            jira_schema = JiraSchema(
                schema_type=JiraSchemaTypes.array,
                items=schema_type,
            )
        else:
            jira_schema = JiraSchema(
                schema_type=schema_type,
            )
        return JiraField(
            name=name,
            key=key or name,
            operations=[],
            has_default_value=False,
            required=required,
            schema=jira_schema,
        )

    def test_multi_user_array(self):
        field = self.create_standard_field(
            name="Foo Bar", key="foobar", schema_type=JiraSchemaTypes.user, is_array=True
        )
        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"foobar": "abcd"}
        )
        assert transformed_data == {"foobar": [{"accountId": "abcd"}]}

        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"foobar": ["abcd", "efgh"]}
        )
        assert transformed_data == {"foobar": [{"accountId": "abcd"}, {"accountId": "efgh"}]}

    def test_transform_single_user(self):
        field = self.create_standard_field(schema_type=JiraSchemaTypes.user, name="barfoo")
        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"barfoo": "abcd"}
        )

        assert transformed_data == {"barfoo": {"accountId": "abcd"}}

    def test_transform_number_field(self):
        field = self.create_standard_field(schema_type=JiraSchemaTypes.number, name="num_field")
        with pytest.raises(IntegrationFormError) as exc:
            transform_fields(
                self.client.user_id_field(), jira_fields=[field], **{"num_field": "abcd"}
            )

        assert exc.value.field_errors == {
            "num_field": "Invalid number value provided for field: 'abcd'"
        }

        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"num_field": "1.5"}
        )

        assert transformed_data == {"num_field": 1.5}

        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"num_field": "5"}
        )

        assert transformed_data == {"num_field": 5}

    def test_transform_issue_type_field(self):
        field = self.create_standard_field(name="issue", schema_type=JiraSchemaTypes.issue_type)
        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"issue": "abcd"}
        )
        assert transformed_data == {"issue": {"id": "abcd"}}

    def test_transform_option_field(self):
        field = self.create_standard_field(name="option_thing", schema_type=JiraSchemaTypes.option)
        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[field],
            **{"option_thing": "abcd"},
        )
        assert transformed_data == {"option_thing": {"value": "abcd"}}

    def test_transform_issue_link_field(self):
        field = self.create_standard_field(name="link", schema_type=JiraSchemaTypes.issue_link)

        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[field],
            **{"link": "abcd"},
        )

        assert transformed_data == {"link": {"key": "abcd"}}

    def test_transform_project_field(self):
        field = self.create_standard_field(name="project", schema_type=JiraSchemaTypes.project)
        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[field],
            **{"project": "abcd"},
        )

        assert transformed_data == {"project": {"id": "abcd"}}

    def test_sprint_custom_field(self):
        sprint_field = JiraField(
            schema=JiraSchema(
                custom_id=1001,
                custom=JIRA_CUSTOM_FIELD_TYPES["sprint"],
                schema_type=JiraSchemaTypes.array,
                items=JiraSchemaTypes.json,
            ),
            name="sprint",
            key="sprint",
            required=False,
            has_default_value=False,
            operations=[],
        )

        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[sprint_field],
            **{"sprint": 2},
        )

        assert transformed_data == {"sprint": 2}

    def test_version_custom_field(self):
        version_field = JiraField(
            schema=JiraSchema(
                schema_type=JiraSchemaTypes.version,
            ),
            name="fixVersion",
            key="fixVersion",
            required=False,
            has_default_value=False,
            operations=[],
        )

        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[version_field],
            **{"fixVersion": 2},
        )

        assert transformed_data == {"fixVersion": {"id": 2}}

        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[version_field],
            **{"fixVersion": ""},
        )

        assert transformed_data == {}

        transformed_data = transform_fields(
            self.client.user_id_field(),
            jira_fields=[version_field],
            **{"fixVersion": 0},
        )

        assert transformed_data == {"fixVersion": {"id": 0}}

    def test_title_field(self):
        field = self.create_standard_field(name="summary", schema_type=JiraSchemaTypes.string)
        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"title": "a" * 512}
        )
        assert transformed_data == {"summary": "a" * 255}

        transformed_data = transform_fields(
            self.client.user_id_field(), jira_fields=[field], **{"title": "Test Title"}
        )
        assert transformed_data == {"summary": "Test Title"}
