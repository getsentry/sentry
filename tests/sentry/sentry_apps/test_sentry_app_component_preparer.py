from unittest.mock import call, patch

from sentry.models.organization import Organization
from sentry.sentry_apps.components import SentryAppComponentPreparer
from sentry.services.hybrid_cloud.app.serial import serialize_sentry_app_installation
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


@control_silo_test
class TestPreparerIssueLink(TestCase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.install = self.create_sentry_app_installation(slug=self.sentry_app.slug)

        self.component = self.sentry_app.components.first()
        with assume_test_silo_mode(SiloMode.REGION):
            self.project = Organization.objects.get(
                id=self.install.organization_id
            ).project_set.first()

        self.preparer = SentryAppComponentPreparer(
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

        self.preparer.run()

        install = serialize_sentry_app_installation(self.install, self.install.sentry_app)
        assert (
            call(
                install=install,
                project_slug=self.project.slug,
                uri="/sentry/foo",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=install,
                project_slug=self.project.slug,
                uri="/sentry/beep",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=install,
                project_slug=self.project.slug,
                uri="/sentry/bar",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            not call(install=install, project_slug=self.project.slug, uri="/sentry/baz")
            in run.mock_calls
        )


@control_silo_test
class TestPreparerStacktraceLink(TestCase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            schema={"elements": [{"type": "stacktrace-link", "uri": "/redirection"}]}
        )

        self.install = self.create_sentry_app_installation(slug=self.sentry_app.slug)

        self.component = self.sentry_app.components.first()
        with assume_test_silo_mode(SiloMode.REGION):
            self.project = Organization.objects.get(
                id=self.install.organization_id
            ).project_set.first()

        self.preparer = SentryAppComponentPreparer(
            component=self.component, install=self.install, project_slug=self.project.slug
        )

    def test_prepares_components_url(self):
        self.component.schema = {"uri": "/redirection"}

        self.preparer.run()

        assert (
            self.component.schema["url"]
            == f"https://example.com/redirection?installationId={self.install.uuid}&projectSlug={self.project.slug}"
        )


@control_silo_test
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
        with assume_test_silo_mode(SiloMode.REGION):
            self.project = Organization.objects.get(
                id=self.install.organization_id
            ).project_set.first()

    @patch("sentry.mediators.external_requests.SelectRequester.run")
    def test_prepares_components_requiring_requests(self, run):
        self.preparer = SentryAppComponentPreparer(
            component=self.component,
            install=self.install,
            project_slug=self.project.slug,
            values=[
                {"name": "teamId", "value": "Ecosystem"},
                {"name": "assigneeId", "value": "3"},
                {"name": "labelId", "value": "Priority"},
            ],
        )

        self.preparer.run()

        install = serialize_sentry_app_installation(self.install, self.install.sentry_app)

        assert (
            call(
                install=install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/teams",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/assignees",
                dependent_data=json.dumps({"teamId": "Ecosystem"}),
            )
            in run.mock_calls
        )

        assert (
            call(
                install=install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/labels",
                dependent_data=json.dumps({"teamId": "Ecosystem"}),
            )
            in run.mock_calls
        )
