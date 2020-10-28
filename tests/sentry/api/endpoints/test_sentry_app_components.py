from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from sentry.utils.compat.mock import patch, call

from sentry.coreapi import APIError
from sentry.testutils import APITestCase
from sentry.constants import SentryAppInstallationStatus


class SentryAppComponentsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(
            name="Test",
            organization=self.org,
            published=True,
            schema={"elements": [self.create_issue_link_schema()]},
        )

        self.component = self.sentry_app.components.first()

        self.url = reverse("sentry-api-0-sentry-app-components", args=[self.sentry_app.slug])

        self.login_as(user=self.user)

    def test_retrieves_all_components(self):
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert response.data[0] == {
            "uuid": six.text_type(self.component.uuid),
            "type": "issue-link",
            "schema": self.component.schema,
            "sentryApp": {
                "uuid": self.sentry_app.uuid,
                "slug": self.sentry_app.slug,
                "name": self.sentry_app.name,
            },
        }


class OrganizationSentryAppComponentsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.sentry_app1 = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.sentry_app2 = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.sentry_app3 = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.install1 = self.create_sentry_app_installation(
            slug=self.sentry_app1.slug, organization=self.org
        )

        self.install2 = self.create_sentry_app_installation(
            slug=self.sentry_app2.slug, organization=self.org
        )

        self.install3 = self.create_sentry_app_installation(
            slug=self.sentry_app3.slug,
            organization=self.org,
            status=SentryAppInstallationStatus.PENDING,
        )

        self.component1 = self.sentry_app1.components.first()
        self.component2 = self.sentry_app2.components.first()
        self.component3 = self.sentry_app3.components.first()

        self.url = u"{}?projectId={}".format(
            reverse("sentry-api-0-org-sentry-app-components", args=[self.org.slug]), self.project.id
        )

        self.login_as(user=self.user)

    @patch("sentry.mediators.sentry_app_components.Preparer.run")
    def test_retrieves_all_components_for_installed_apps(self, run):
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert self.component3.uuid not in [d["uuid"] for d in response.data]
        assert response.data == [
            {
                "uuid": six.text_type(self.component1.uuid),
                "type": "issue-link",
                "schema": self.component1.schema,
                "sentryApp": {
                    "uuid": self.sentry_app1.uuid,
                    "slug": self.sentry_app1.slug,
                    "name": self.sentry_app1.name,
                },
            },
            {
                "uuid": six.text_type(self.component2.uuid),
                "type": "issue-link",
                "schema": self.component2.schema,
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                },
            },
        ]

    @patch("sentry.mediators.sentry_app_components.Preparer.run")
    def test_project_not_owned_by_org(self, run):
        org = self.create_organization(owner=self.create_user())
        project = self.create_project(organization=org)

        response = self.client.get(
            "{}?projectId={}".format(
                reverse("sentry-api-0-org-sentry-app-components", args=[self.org.slug]), project.id
            ),
            format="json",
        )

        assert response.status_code == 404
        assert response.data == []

    @patch("sentry.mediators.sentry_app_components.Preparer.run")
    def test_filter_by_type(self, run):
        sentry_app = self.create_sentry_app(schema={"elements": [{"type": "alert-rule"}]})

        self.create_sentry_app_installation(slug=sentry_app.slug, organization=self.org)

        component = sentry_app.components.first()

        response = self.client.get(u"{}&filter=alert-rule".format(self.url), format="json")

        assert response.data == [
            {
                "uuid": six.text_type(component.uuid),
                "type": "alert-rule",
                "schema": component.schema,
                "sentryApp": {
                    "uuid": sentry_app.uuid,
                    "slug": sentry_app.slug,
                    "name": sentry_app.name,
                },
            }
        ]

    @patch("sentry.mediators.sentry_app_components.Preparer.run")
    def test_prepares_each_component(self, run):
        self.client.get(self.url, format="json")

        calls = [
            call(component=self.component1, install=self.install1, project=self.project),
            call(component=self.component2, install=self.install2, project=self.project),
        ]

        run.assert_has_calls(calls, any_order=True)

    @patch("sentry.mediators.sentry_app_components.Preparer.run")
    def test_component_prep_errors_are_isolated(self, run):
        run.side_effect = [APIError(), self.component2]

        response = self.client.get(self.url, format="json")

        # Does not include self.component1 data, because it raised an exception
        # during preparation.
        assert response.data == [
            {
                "uuid": six.text_type(self.component2.uuid),
                "type": self.component2.type,
                "schema": self.component2.schema,
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                },
            }
        ]
