from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.conf import settings

from sentry import tagstore
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class ProjectTagKeyValuesTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        if settings.SENTRY_TAGSTORE in [
            "sentry.tagstore.snuba.SnubaCompatibilityTagStorage",
            "sentry.tagstore.snuba.SnubaTagStorage",
        ]:
            project = self.create_project()
            self.store_event(
                data={"tags": {"foo": "bar"}, "timestamp": iso_format(before_now(seconds=1))},
                project_id=project.id,
            )
        else:
            project = self.create_project()
            tagstore.create_tag_key(project_id=project.id, environment_id=None, key="foo")
            tagstore.create_tag_value(
                project_id=project.id, environment_id=None, key="foo", value="bar"
            )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-tagkey-values",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key": "foo",
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == "bar"

    def test_query(self):
        if settings.SENTRY_TAGSTORE in [
            "sentry.tagstore.snuba.SnubaCompatibilityTagStorage",
            "sentry.tagstore.snuba.SnubaTagStorage",
        ]:
            project = self.create_project()
            self.store_event(
                data={"tags": {"foo": "bar"}, "timestamp": iso_format(before_now(seconds=1))},
                project_id=project.id,
            )
        else:
            project = self.create_project()
            tagstore.create_tag_key(project_id=project.id, environment_id=None, key="foo")
            tagstore.create_tag_value(
                project_id=project.id, environment_id=None, key="foo", value="bar"
            )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-tagkey-values",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key": "foo",
            },
        )
        response = self.client.get(url + "?query=bar")

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == "bar"

        response = self.client.get(url + "?query=foo")

        assert response.status_code == 200
        assert len(response.data) == 0
