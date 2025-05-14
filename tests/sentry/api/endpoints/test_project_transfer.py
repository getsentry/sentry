import re
from urllib.parse import ParseResult, parse_qs, urlparse

from django.core import mail
from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.project_transfer import SALT
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.signing import unsign


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
                assert response.data == {
                    "detail": "Could not find an organization owner with that email"
                }
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

    def test_transfer_project_to_current_organization(self):
        owner_a = self.create_user("a@example.com")
        org_a = self.create_organization(name="Org A", slug="org-a", owner=owner_a)

        project = self.create_project(organization=org_a)
        self.login_as(user=owner_a)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={"organization_id_or_slug": org_a.slug, "project_id_or_slug": project.slug},
        )

        with self.tasks():
            response = self.client.post(url, {"email": "a@example.com"})

        assert len(mail.outbox) == 0
        assert response.status_code == 400
        assert response.data == {"detail": "Cannot transfer project to the same organization."}

    def test_transfer_project_to_multiple_accounts(self):
        owner_a = self.create_user("a@example.com")
        org_a = self.create_organization(name="Org A", slug="org-a", owner=owner_a)

        owner_b = self.create_user("b@example.com")
        self.create_useremail(owner_b, "shared@example.com")
        self.create_organization(name="Org B", slug="org-b", owner=owner_b)

        owner_c = self.create_user("c@example.com")
        self.create_useremail(owner_c, "shared@example.com")
        self.create_organization(name="Org C", slug="org-c", owner=owner_c)

        project = self.create_project(organization=org_a)
        self.login_as(user=owner_a)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={
                "organization_id_or_slug": org_a.slug,
                "project_id_or_slug": project.slug,
            },
        )

        # Should fail when email is associated with multiple accounts
        with self.tasks():
            response = self.client.post(url, {"email": "shared@example.com"})

        assert len(mail.outbox) == 0
        assert response.status_code == 400
        assert response.data == {
            "detail": "That email belongs to multiple accounts. Contact the person and ensure the email is associated with only one account."
        }

        # Should work when email is only associated with one account
        with self.tasks():
            response = self.client.post(url, {"email": "c@example.com"})
        assert len(mail.outbox) == 1
        assert response.status_code == 204

    def test_transfer_project_to_multiple_accounts_ignores_project_org(self):
        owner_a = self.create_user("a@example.com")
        self.create_useremail(owner_a, "shared@example.com")
        org_a = self.create_organization(name="Org A", slug="org-a", owner=owner_a)

        owner_b = self.create_user("b@example.com")
        self.create_useremail(owner_b, "shared@example.com")
        self.create_organization(name="Org B", slug="org-b", owner=owner_b)

        project = self.create_project(organization=org_a)
        self.login_as(user=owner_a)

        url = reverse(
            "sentry-api-0-project-transfer",
            kwargs={"organization_id_or_slug": org_a.slug, "project_id_or_slug": project.slug},
        )

        with self.tasks():
            response = self.client.post(url, {"email": "shared@example.com"})

        assert response.status_code == 204
        assert len(mail.outbox) == 1

        mail_body = mail.outbox[0].body
        transfer_link_match = re.search(
            r"(http://testserver/accept-transfer/\?[^\s]+)", str(mail_body)
        )
        assert transfer_link_match is not None
        transfer_link = transfer_link_match.group()
        parsed_url: ParseResult = urlparse(url=transfer_link)
        parsed_qs = parse_qs(parsed_url.query)
        signed_data = str(parsed_qs["data"][0])
        parsed_data = unsign(signed_data, salt=SALT)

        assert parsed_data["actor_id"] == owner_a.id
        assert parsed_data["user_id"] == owner_b.id
        assert parsed_data["project_id"] == project.id
        assert parsed_data["from_organization_id"] == org_a.id
        assert parsed_data["transaction_id"] is not None
