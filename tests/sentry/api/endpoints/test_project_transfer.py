from django.core import mail
from django.test import override_settings
from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


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
            assert (
                ProjectOption.objects.get_value(project, "sentry:project-transfer-transaction-id")
                is not None
            )

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

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_rate_limit(self):
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

        with freeze_time("2024-07-01"):
            for _ in range(3 + 1):
                response = self.client.post(url, {"email": new_user.email})
        assert response.status_code == 429
        assert (
            response.content
            == b'"You are attempting to use this endpoint too frequently. Limit is 3 requests in 3600 seconds"'
        )
