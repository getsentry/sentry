from django.core import mail
from django.urls import reverse

from sentry.testutils.cases import APITestCase


class ProjectTransferTest(APITestCase):
    def test_internal_project(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.post(url, {"email": "b@example.com"})

        assert response.status_code == 403

    def test_transfer_project(self):
        project = self.create_project()
        organization = project.organization

        new_user = self.create_user("b@example.com")
        self.create_organization(name="New Org", owner=new_user)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={
                "organization_id_or_slug": organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        with self.tasks():
            response = self.client.post(url, {"email": new_user.email})

            assert response.status_code == 204
            assert len(mail.outbox) == 1
            assert "http://testserver/accept-transfer/?" in mail.outbox[0].body

    def test_transfer_project_to_invalid_user(self):
        project = self.create_project()
        # new user is not an owner of anything
        new_user = self.create_user("b@example.com")

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        with self.settings(SENTRY_PROJECT=0):
            with self.tasks():
                response = self.client.post(url, {"email": new_user.email})

                assert response.status_code == 404
                assert not mail.outbox
