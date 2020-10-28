from __future__ import absolute_import

from sentry.utils.compat import mock

from django.core import mail
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectTransferTest(APITestCase):
    def test_internal_project(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.post(url, {"email": "b@example.com"})

        assert response.status_code == 403

    @mock.patch("sentry.api.endpoints.project_details.uuid4")
    def test_transfer_project(self, mock_uuid4):
        class uuid(object):
            hex = "abc123"

        mock_uuid4.return_value = uuid
        project = self.create_project()
        new_user = self.create_user("b@example.com")
        self.create_organization(name="New Org", owner=new_user)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        with self.settings(SENTRY_PROJECT=0):
            with self.tasks():
                response = self.client.post(url, {"email": new_user.email})

                assert response.status_code == 204
                # stdout seems to print log messages that mail should be sent but this
                # assertion does not pass
                assert mail.outbox

    @mock.patch("sentry.api.endpoints.project_details.uuid4")
    def test_transfer_project_to_invalid_user(self, mock_uuid4):
        class uuid(object):
            hex = "abc123"

        mock_uuid4.return_value = uuid
        project = self.create_project()
        # new user is not an owner of anything
        new_user = self.create_user("b@example.com")

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        with self.settings(SENTRY_PROJECT=0):
            with self.tasks():
                response = self.client.post(url, {"email": new_user.email})

                assert response.status_code == 404
                assert not mail.outbox
