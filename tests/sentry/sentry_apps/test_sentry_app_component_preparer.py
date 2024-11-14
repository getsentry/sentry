from collections.abc import Mapping

import responses

from sentry.models.organization import Organization
from sentry.sentry_apps.components import SentryAppComponentPreparer
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


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
            ).project_set.get()

        self.preparer = SentryAppComponentPreparer(
            component=self.component, install=self.install, project_slug=self.project.slug
        )

    @responses.activate
    def test_prepares_components_requiring_requests(self):

        # the webhook uris that we'll contact to get field options
        uris = ["sentry/foo", "sentry/beep", "sentry/bar"]

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

        responses.add(
            method=responses.GET,
            url=f"https://example.com/{uris[0]}?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=[{"label": "Skibidi", "value": "Toilet", "default": True}],
            status=200,
            content_type="application/json",
        )
        responses.add(
            method=responses.GET,
            url=f"https://example.com/{uris[1]}?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=[{"label": "Dentge", "value": "skateparkge"}],
            status=200,
            content_type="application/json",
        )

        responses.add(
            method=responses.GET,
            url=f"https://example.com/{uris[2]}?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=[{"label": "uhhhhh idk", "value": "great_idea"}],
            status=200,
            content_type="application/json",
        )

        self.preparer.run()

        # check that we did not make a request for skip_on_load components
        assert not any("/sentry/baz" in request.url for request, response in responses.calls)


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
            ).project_set.get()

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

    @responses.activate
    def test_prepares_components_requiring_requests(self):

        # these get passed as query params in the url as dependentData
        dependent_data: list[Mapping[str, str]] = [
            {"name": "teamId", "value": "ecosystem"},
        ]

        uris = [
            "hooks/sentry/issues/teams",
            "hooks/sentry/issues/assignees",
            "hooks/sentry/issues/labels",
        ]

        teams_response = [
            {"label": "Team A", "value": "ecosystem", "default": True},
            {"label": "Team B", "value": "coolkids"},
        ]

        assignees_response = [
            {"label": "Random Person", "value": "1", "default": True},
            {"label": "Coolest Cucumber", "value": "3"},
        ]

        labels_response = [
            {"label": "P0", "value": "iguessilldoit"},
            {"label": "Maybe Tommorrow", "value": "sure", "default": True},
        ]

        self.preparer = SentryAppComponentPreparer(
            component=self.component,
            install=self.install,
            project_slug=self.project.slug,
            values=dependent_data,
        )

        responses.add(
            method=responses.GET,
            url=f"https://example.com/{uris[0]}?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=teams_response,
            status=200,
            content_type="application/json",
        )

        responses.add(
            method=responses.GET,
            url=f"https://example.com/{uris[1]}?installationId={self.install.uuid}&projectSlug={self.project.slug}&dependentData=%7B%22{dependent_data[0]['name']}%22%3A%22{dependent_data[0]['value']}%22%7D",
            json=assignees_response,
            status=200,
            content_type="application/json",
        )

        responses.add(
            method=responses.GET,
            url=f"https://example.com/{uris[2]}?installationId={self.install.uuid}&projectSlug={self.project.slug}&dependentData=%7B%22{dependent_data[0]['name']}%22%3A%22{dependent_data[0]['value']}%22%7D",
            json=labels_response,
            status=200,
            content_type="application/json",
        )

        self.preparer.run()
