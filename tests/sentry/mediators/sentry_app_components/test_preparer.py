from __future__ import absolute_import

from sentry.utils.compat.mock import patch, call

from sentry.mediators.sentry_app_components import Preparer
from sentry.testutils import TestCase


class TestPreparerIssueLink(TestCase):
    def setUp(self):
        super(TestPreparerIssueLink, self).setUp()

        self.sentry_app = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.install = self.create_sentry_app_installation(slug=self.sentry_app.slug)

        self.component = self.sentry_app.components.first()
        self.project = self.install.organization.project_set.first()

        self.preparer = Preparer(
            component=self.component, install=self.install, project=self.project
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

        assert call(install=self.install, project=self.project, uri="/sentry/foo") in run.mock_calls

        assert (
            call(install=self.install, project=self.project, uri="/sentry/beep") in run.mock_calls
        )

        assert call(install=self.install, project=self.project, uri="/sentry/bar") in run.mock_calls

        assert (
            not call(install=self.install, project=self.project, uri="/sentry/baz")
            in run.mock_calls
        )


class TestPreparerStacktraceLink(TestCase):
    def setUp(self):
        super(TestPreparerStacktraceLink, self).setUp()

        self.sentry_app = self.create_sentry_app(
            schema={"elements": [{"type": "stacktrace-link", "uri": "/redirection"}]}
        )

        self.install = self.create_sentry_app_installation(slug=self.sentry_app.slug)

        self.component = self.sentry_app.components.first()
        self.project = self.install.organization.project_set.first()

        self.preparer = Preparer(
            component=self.component, install=self.install, project=self.project
        )

    def test_prepares_components_url(self):
        self.component.schema = {"uri": "/redirection"}

        self.preparer.call()

        assert self.component.schema[
            "url"
        ] == u"https://example.com/redirection?installationId={}&projectSlug={}".format(
            self.install.uuid, self.project.slug
        )
