from __future__ import absolute_import

from sentry.utils.compat import mock

from django.core.urlresolvers import reverse

from sentry import tagstore
from sentry.tagstore import TagKeyStatus
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class ProjectTagKeyDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        project = self.create_project()

        def make_event(i):
            self.store_event(
                data={
                    "tags": {"foo": "val{}".format(i)},
                    "timestamp": iso_format(before_now(seconds=1)),
                },
                project_id=project.id,
            )

        for i in range(0, 16):
            make_event(i)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-tagkey-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key": "foo",
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["uniqueValues"] == 16


class ProjectTagKeyDeleteTest(APITestCase):
    @mock.patch("sentry.eventstream")
    def test_simple(self, mock_eventstream):
        key = "foo"
        val = "bar"

        project = self.create_project()
        self.store_event(
            data={"tags": {key: val}, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )

        self.login_as(user=self.user)

        eventstream_state = object()
        mock_eventstream.start_delete_tag = mock.Mock(return_value=eventstream_state)

        url = reverse(
            "sentry-api-0-project-tagkey-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key": key,
            },
        )

        response = self.client.delete(url)

        assert response.status_code == 204

        mock_eventstream.start_delete_tag.assert_called_once_with(project.id, "foo")
        mock_eventstream.end_delete_tag.assert_called_once_with(eventstream_state)

    def test_protected(self):
        project = self.create_project()
        self.store_event(
            data={"environment": "prod", "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-tagkey-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key": "environment",
            },
        )

        response = self.client.delete(url)

        assert response.status_code == 403

        assert (
            tagstore.get_tag_key(
                project.id, None, "environment", status=TagKeyStatus.VISIBLE  # environment_id
            ).status
            == TagKeyStatus.VISIBLE
        )
