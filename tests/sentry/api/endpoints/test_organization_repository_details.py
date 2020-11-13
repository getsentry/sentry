from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from django.core.urlresolvers import reverse

from sentry.constants import ObjectStatus
from sentry.models import Commit, Integration, OrganizationOption, Repository
from sentry.testutils import APITestCase


class OrganizationRepositoryDeleteTest(APITestCase):
    def setUp(self):
        super(OrganizationRepositoryDeleteTest, self).setUp()

        class mock_uuid(object):
            hex = "1234567"

        self.mock_uuid = mock_uuid

    def assert_rename_pending_delete(self, response, repo, external_id=None):
        assert response.data["status"] == u"pending_deletion"
        assert response.data["name"] == "example"  # name displayed matches what the user expects

        assert repo.status == ObjectStatus.PENDING_DELETION
        assert repo.name == "1234567"
        assert repo.external_id == "1234567"
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

    @patch("sentry.api.endpoints.organization_repository_details.get_transaction_id")
    @patch("sentry.api.endpoints.organization_repository_details.delete_repository")
    def test_delete_no_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = "1"

        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        with patch("sentry.db.mixin.uuid4", new=self.mock_uuid):
            response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        mock_delete_repository.apply_async.assert_called_with(
            kwargs={"object_id": repo.id, "transaction_id": "1", "actor_id": self.user.id},
            countdown=0,
        )
        self.assert_rename_pending_delete(response, repo)

    @patch("sentry.api.endpoints.organization_repository_details.get_transaction_id")
    @patch("sentry.api.endpoints.organization_repository_details.delete_repository")
    def test_delete_with_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = "1"
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, external_id="abc123"
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.mixin.uuid4", new=self.mock_uuid):
            response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION
        mock_delete_repository.apply_async.assert_called_with(
            kwargs={"object_id": repo.id, "transaction_id": "1", "actor_id": self.user.id},
            countdown=3600,
        )
        self.assert_rename_pending_delete(response, repo, "abc123")

    @patch("sentry.api.endpoints.organization_repository_details.get_transaction_id")
    @patch("sentry.api.endpoints.organization_repository_details.delete_repository")
    def test_delete_disabled_no_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = "1"

        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example",
            external_id="abc12345",
            organization_id=org.id,
            status=ObjectStatus.DISABLED,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.mixin.uuid4", new=self.mock_uuid):
            response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        mock_delete_repository.apply_async.assert_called_with(
            kwargs={"object_id": repo.id, "transaction_id": "1", "actor_id": self.user.id},
            countdown=0,
        )

        self.assert_rename_pending_delete(response, repo, "abc12345")

    @patch("sentry.api.endpoints.organization_repository_details.get_transaction_id")
    @patch("sentry.api.endpoints.organization_repository_details.delete_repository")
    def test_delete_disabled_with_commits(self, mock_delete_repository, mock_get_transaction_id):
        mock_get_transaction_id.return_value = "1"
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, status=ObjectStatus.DISABLED
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.mixin.uuid4", new=self.mock_uuid):
            response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        mock_delete_repository.apply_async.assert_called_with(
            kwargs={"object_id": repo.id, "transaction_id": "1", "actor_id": self.user.id},
            countdown=3600,
        )
        self.assert_rename_pending_delete(response, repo)

    def test_put(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = Integration.objects.create(provider="example", name="example")
        integration.add_organization(org)

        repo = Repository.objects.create(
            name="example", organization_id=org.id, status=ObjectStatus.DISABLED
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.VISIBLE
        assert repo.integration_id == integration.id

    def test_put_cancel_deletion(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = Integration.objects.create(provider="example", name="example")
        integration.add_organization(org)

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
        assert repo.status == ObjectStatus.VISIBLE
        assert repo.integration_id == integration.id
        assert repo.provider == "integrations:example"
        assert repo.name == "example-name"
        assert repo.external_id == "example-external-id"
        assert repo.config == {}

        assert not OrganizationOption.objects.filter(
            organization_id=org.id, key=repo.build_pending_deletion_key()
        ).exists()

    def test_put_cancel_deletion_duplicate_exists(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = Integration.objects.create(provider="example", name="example")
        integration.add_organization(org)

        repo = Repository.objects.create(
            name="uuid-name",
            external_id="uuid-external-id",
            organization_id=org.id,
            status=ObjectStatus.PENDING_DELETION,
            config={"pending_deletion_name": "example-name"},
        )

        repo2 = Repository.objects.create(
            name="example_name",
            external_id="uuid-external-id",
            organization_id=org.id,
            status=ObjectStatus.VISIBLE,
        )

        OrganizationOption.objects.create(
            organization_id=org.id,
            key=repo.build_pending_deletion_key(),
            value={
                "name": "example_name",
                "external_id": "example-external-id",
                "id": repo.id,
                "model": Repository.__name__,
            },
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})
        assert response.status_code == 500

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION
        assert repo.name == "uuid-name"

        repo2 = Repository.objects.get(id=repo2.id)
        assert repo2.status == ObjectStatus.VISIBLE
        assert repo2.name == "example_name"

    def test_put_bad_integration_org(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
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
