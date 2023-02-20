from unittest.mock import call, patch

from sentry.mediators.sentry_app_components import Preparer
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class TestPreparerIssueLink(TestCase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.install = self.create_sentry_app_installation(slug=self.sentry_app.slug)

        self.component = self.sentry_app.components.first()
        self.project = self.install.organization.project_set.first()

        self.preparer = Preparer(
            component=self.component, install=self.install, project_slug=self.project.slug
        )

    @patch("sentry.mediators.external_requests.SelectRequester.run")
    def test_prepares_components_requiring_requests(self, run):
        self.component.schema = {
            "link": {
                "required_fields": [
                    {"type": "select", "name": "foo", "label": "Foo", "uri": "/sentry/foo"}
                ],
                "optional_fields": [
                    {"type": "select", "name": "beep", "label": "Beep", "uri": "/sentry/beep"}
                ],
            },
            "create": {
                "required_fields": [
                    {"type": "select", "name": "bar", "label": "Bar", "uri": "/sentry/bar"}
                ],
                "optional_fields": [
                    {
                        "type": "select",
                        "name": "baz",
                        "label": "Baz",
                        "uri": "/sentry/baz",
                        "skip_load_on_open": True,
                    }
                ],
            },
        }

        self.preparer.call()

        assert (
            call(
                install=self.install,
                project_slug=self.project.slug,
                uri="/sentry/foo",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.install,
                project_slug=self.project.slug,
                uri="/sentry/beep",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.install,
                project_slug=self.project.slug,
                uri="/sentry/bar",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            not call(install=self.install, project_slug=self.project.slug, uri="/sentry/baz")
            in run.mock_calls
        )


class TestPreparerStacktraceLink(TestCase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            schema={"elements": [{"type": "stacktrace-link", "uri": "/redirection"}]}
        )

        self.install = self.create_sentry_app_installation(slug=self.sentry_app.slug)

        self.component = self.sentry_app.components.first()
        self.project = self.install.organization.project_set.first()

        self.preparer = Preparer(
            component=self.component, install=self.install, project_slug=self.project.slug
        )

    def test_prepares_components_url(self):
        self.component.schema = {"uri": "/redirection"}

        self.preparer.call()

        assert (
            self.component.schema["url"]
            == f"https://example.com/redirection?installationId={self.install.uuid}&projectSlug={self.project.slug}"
        )


class TestPreparerAlertRuleAction(TestCase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            name="Pied Piper",
            organization=self.project.organization,
            schema={
                "elements": [
                    {
                        "type": "alert-rule-action",
                        "title": "Create a Issue",
                        "settings": {
                            "type": "alert-rule-settings",
                            "uri": "/hooks/sentry/alert-rule-action",
                            "description": "When the alert fires automatically create an issue with the following properties.",
                            "required_fields": [
                                {
                                    "name": "teamId",
                                    "label": "Team",
                                    "type": "select",
                                    "uri": "/hooks/sentry/issues/teams",
                                }
                            ],
                            "optional_fields": [
                                {
                                    "name": "assigneeId",
                                    "label": "Assignee",
                                    "type": "select",
                                    "uri": "/hooks/sentry/issues/assignees",
                                    "depends_on": ["teamId"],
                                },
                                {
                                    "name": "labelId",
                                    "label": "Label",
                                    "type": "select",
                                    "uri": "/hooks/sentry/issues/labels",
                                    "depends_on": ["teamId"],
                                },
                            ],
                        },
                    }
                ]
            },
        )
        self.install = self.create_sentry_app_installation(
            slug="pied-piper", organization=self.project.organization
        )

        self.component = self.sentry_app.components.first()
        self.project = self.install.organization.project_set.first()

    @patch("sentry.mediators.external_requests.SelectRequester.run")
    def test_prepares_components_requiring_requests(self, run):
        self.preparer = Preparer(
            component=self.component,
            install=self.install,
            project_slug=self.project.slug,
            values=[
                {"name": "teamId", "value": "Ecosystem"},
                {"name": "assigneeId", "value": "3"},
                {"name": "labelId", "value": "Priority"},
            ],
        )

        self.preparer.call()

        assert (
            call(
                install=self.install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/teams",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/assignees",
                dependent_data=json.dumps({"teamId": "Ecosystem"}),
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/labels",
                dependent_data=json.dumps({"teamId": "Ecosystem"}),
            )
            in run.mock_calls
        )
