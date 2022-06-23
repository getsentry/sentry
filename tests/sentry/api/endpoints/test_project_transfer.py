from django.core import mail
from django.urls import reverse

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

    def test_transfer_project(self):
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

    def test_transfer_project_with_alert_owners(self):
        project = self.create_project()
        new_user = self.create_user("b@example.com")
        self.create_organization(name="New Org", owner=new_user)
        alert_owner = self.create_user(email="c@example.com")
        _ = self.create_alert_rule(
            name="alert_rule_0",
            user=self.user,
            organization=self.project.organization,
            owner=alert_owner.actor.get_actor_tuple(),
        )

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

    def test_transfer_project_to_invalid_user(self):
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
