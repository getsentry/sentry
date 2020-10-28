from __future__ import absolute_import

from .util import invalid_schema_with_error_message
from sentry.testutils import TestCase
from sentry.api.validators.sentry_apps.schema import validate_ui_element_schema


class TestSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            "elements": [
                {
                    "type": "issue-link",
                    "link": {
                        "uri": "/sentry/issues/link",
                        "required_fields": [
                            {
                                "type": "select",
                                "name": "assignee",
                                "label": "Assignee",
                                "uri": "/sentry/members",
                            }
                        ],
                    },
                    "create": {
                        "uri": "/sentry/issues/create",
                        "required_fields": [
                            {"type": "text", "name": "title", "label": "Title"},
                            {"type": "text", "name": "summary", "label": "Summary"},
                        ],
                        "optional_fields": [
                            {
                                "type": "select",
                                "name": "points",
                                "label": "Points",
                                "options": [
                                    ["1", "1"],
                                    ["2", "2"],
                                    ["3", "3"],
                                    ["5", "5"],
                                    ["8", "8"],
                                ],
                            },
                            {
                                "type": "select",
                                "name": "assignee",
                                "label": "Assignee",
                                "uri": "/sentry/members",
                            },
                        ],
                    },
                },
                {
                    "type": "alert-rule-action",
                    "required_fields": [
                        {"type": "text", "name": "channel", "label": "Channel"},
                        {
                            "type": "select",
                            "name": "send_email",
                            "label": "Send Email?",
                            "options": [["Yes", "yes"], ["No", "no"]],
                        },
                    ],
                },
                {
                    "type": "issue-media",
                    "title": "Feature Demo",
                    "elements": [{"type": "video", "url": "/sentry/issues/video"}],
                },
                {"type": "stacktrace-link", "uri": "/sentry/issue"},
            ]
        }

    def test_valid_schema_with_options(self):
        validate_ui_element_schema(self.schema)

    @invalid_schema_with_error_message("'elements' is a required property")
    def test_invalid_schema_elements_missing(self):
        schema = {"type": "nothing"}
        validate_ui_element_schema(schema)

    @invalid_schema_with_error_message("'elements' should be an array of objects")
    def test_invalid_schema_elements_not_array(self):
        schema = {"elements": {"type": "issue-link"}}
        validate_ui_element_schema(schema)

    @invalid_schema_with_error_message("Each element needs a 'type' field")
    def test_invalid_schema_type_missing(self):
        schema = {"elements": [{"key": "issue-link"}]}
        validate_ui_element_schema(schema)

    @invalid_schema_with_error_message(
        "Element has type 'other'. Type must be one of the following: ['issue-link', 'alert-rule-action', 'issue-media', 'stacktrace-link']"
    )
    def test_invalid_schema_type_invalid(self):
        schema = {"elements": [{"type": "other"}]}
        validate_ui_element_schema(schema)

    @invalid_schema_with_error_message(
        "'uri' is a required property for element of type 'stacktrace-link'"
    )
    def test_invalid_chema_element_missing_uri(self):
        schema = {
            "elements": [{"url": "/stacktrace/github/getsentry/sentry", "type": "stacktrace-link"}]
        }
        validate_ui_element_schema(schema)
