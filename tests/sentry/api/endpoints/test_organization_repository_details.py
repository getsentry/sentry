from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.models.commit import Commit
from sentry.models.integrations.integration import Integration
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repository import Repository
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class OrganizationRepositoryDeleteTest(APITestCase):
    def assert_rename_pending_delete(self, response, repo, external_id=None):
        assert response.data["status"] == "pending_deletion"
        assert response.data["name"] == "example"  # name displayed matches what the user expects

        assert repo.status == ObjectStatus.PENDING_DELETION
        assert repo.name == "abc123"
        assert repo.external_id == "abc123"
        assert repo.config["pending_deletion_name"] == "example"

        option = OrganizationOption.objects.get(
            organization_id=repo.organization_id, key=repo.build_pending_deletion_key()
        )
        assert option.value == {
            "id": repo.id,
            "model": Repository.__name__,
            "name": "example",
            "external_id": external_id,
        }

    def test_delete_no_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        with patch("sentry.db.mixin.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository", date_scheduled__lte=timezone.now()
        ).exists()
        self.assert_rename_pending_delete(response, repo)

    def test_delete_with_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, external_id="abc123"
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.mixin.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository", date_scheduled__gt=timezone.now()
        ).exists()
        self.assert_rename_pending_delete(response, repo, "abc123")

    def test_delete_disabled_no_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example",
            external_id="abc12345",
            organization_id=org.id,
            status=ObjectStatus.DISABLED,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.mixin.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository"
        ).exists()
        self.assert_rename_pending_delete(response, repo, "abc12345")

    def test_delete_disabled_with_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, status=ObjectStatus.DISABLED
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.mixin.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository"
        ).exists()
        self.assert_rename_pending_delete(response, repo)

    def test_put(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        repo = Repository.objects.create(
            name="example", organization_id=org.id, status=ObjectStatus.DISABLED
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.integration_id == integration.id

    def test_put_cancel_deletion(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        repo = Repository.objects.create(
            name="uuid-name",
            external_id="uuid-external-id",
            organization_id=org.id,
            status=ObjectStatus.PENDING_DELETION,
            config={"pending_deletion_name": "example-name"},
        )

        OrganizationOption.objects.create(
            organization_id=org.id,
            key=repo.build_pending_deletion_key(),
            value={
                "name": "example-name",
                "external_id": "example-external-id",
                "id": repo.id,
                "model": Repository.__name__,
            },
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.integration_id == integration.id
        assert repo.provider == "integrations:example"
        assert repo.name == "example-name"
        assert repo.external_id == "example-external-id"
        assert repo.config == {}

        assert not OrganizationOption.objects.filter(
            organization_id=org.id, key=repo.build_pending_deletion_key()
        ).exists()

    def test_put_hide_repo(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(
            name="uuid-name",
            external_id="uuid-external-id",
            organization_id=org.id,
            status=ObjectStatus.ACTIVE,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "hidden"})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN

    def test_put_hide_repo_with_commits(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, external_id="abc123"
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with self.tasks():
            response = self.client.put(url, data={"status": "hidden"})
            assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN
        assert len(Commit.objects.filter(repository_id=repo.id)) == 0

    def test_put_bad_integration_org(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(provider="example", name="example")

        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        # integration isn't linked to org
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid integration id"
        assert Repository.objects.get(id=repo.id).name == "example"

    def test_put_bad_integration_id(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        # integration isn't linked to org
        response = self.client.put(url, data={"status": "visible", "integrationId": "notanumber"})

        assert response.status_code == 400
        assert response.data == {"integrationId": ["A valid integer is required."]}
        assert Repository.objects.get(id=repo.id).name == "example"
