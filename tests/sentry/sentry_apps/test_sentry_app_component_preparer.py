from unittest.mock import call, patch

from sentry.models.organization import Organization
from sentry.sentry_apps.components import SentryAppComponentPreparer
from sentry.services.hybrid_cloud.app.serial import (
    serialize_sentry_app_component,
    serialize_sentry_app_installation,
)
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
        self.rpc_install = serialize_sentry_app_installation(self.install)

        self.component = self.sentry_app.components.first()
        self.rpc_component = serialize_sentry_app_component(self.component)

        with assume_test_silo_mode(SiloMode.REGION):
            self.project = Organization.objects.get(
                id=self.install.organization_id
            ).project_set.first()

        self.preparer = SentryAppComponentPreparer(
            component=self.rpc_component, install=self.rpc_install, project_slug=self.project.slug
        )

    @patch("sentry.mediators.external_requests.SelectRequester.run")
    def test_prepares_components_requiring_requests(self, run):
        self.rpc_component.app_schema = {
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

        assert (
            call(
                install=self.rpc_install,
                project_slug=self.project.slug,
                uri="/sentry/foo",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.rpc_install,
                project_slug=self.project.slug,
                uri="/sentry/beep",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.rpc_install,
                project_slug=self.project.slug,
                uri="/sentry/bar",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            not call(install=self.rpc_install, project_slug=self.project.slug, uri="/sentry/baz")
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
        self.rpc_install = serialize_sentry_app_installation(self.install)

        self.component = self.sentry_app.components.first()
        self.rpc_component = serialize_sentry_app_component(self.component)

        with assume_test_silo_mode(SiloMode.REGION):
            self.project = Organization.objects.get(
                id=self.install.organization_id
            ).project_set.first()

        self.preparer = SentryAppComponentPreparer(
            component=self.rpc_component, install=self.rpc_install, project_slug=self.project.slug
        )

    def test_prepares_components_url(self):
        self.rpc_component.app_schema = {"uri": "/redirection"}

        self.preparer.run()

        assert (
            self.rpc_component.app_schema["url"]
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
        self.rpc_install = serialize_sentry_app_installation(self.install)

        self.component = self.sentry_app.components.first()
        self.rpc_component = serialize_sentry_app_component(self.component)

        with assume_test_silo_mode(SiloMode.REGION):
            self.project = Organization.objects.get(
                id=self.install.organization_id
            ).project_set.first()

    @patch("sentry.mediators.external_requests.SelectRequester.run")
    def test_prepares_components_requiring_requests(self, run):
        self.preparer = SentryAppComponentPreparer(
            component=self.rpc_component,
            install=self.rpc_install,
            project_slug=self.project.slug,
            values=[
                {"name": "teamId", "value": "Ecosystem"},
                {"name": "assigneeId", "value": "3"},
                {"name": "labelId", "value": "Priority"},
            ],
        )

        self.preparer.run()

        assert (
            call(
                install=self.rpc_install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/teams",
                dependent_data=None,
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.rpc_install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/assignees",
                dependent_data=json.dumps({"teamId": "Ecosystem"}),
            )
            in run.mock_calls
        )

        assert (
            call(
                install=self.rpc_install,
                project_slug=self.project.slug,
                uri="/hooks/sentry/issues/labels",
                dependent_data=json.dumps({"teamId": "Ecosystem"}),
            )
            in run.mock_calls
        )
