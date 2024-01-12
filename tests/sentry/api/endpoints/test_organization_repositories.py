from unittest.mock import patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.example import ExampleRepositoryProvider
from sentry.models.repository import Repository
from sentry.plugins.providers.dummy.repository import DummyRepositoryProvider
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationRepositoriesListTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.org = self.create_organization(owner=self.user, name="baz")
        self.url = reverse("sentry-api-0-organization-repositories", args=[self.org.slug])

        self.login_as(user=self.user)

    def test_simple(self):
        repo = Repository.objects.create(name="example", organization_id=self.org.id)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(repo.id)
        assert response.data[0]["externalSlug"] is None

    def test_get_integration_repository(self):
        repo = Repository.objects.create(
            name="getsentry/example",
            organization_id=self.org.id,
            external_id=12345,
            provider="dummy",
            config={"name": "getsentry/example"},
        )

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        first_row = response.data[0]
        assert first_row["id"] == str(repo.id)
        assert first_row["provider"] == {"id": "dummy", "name": "Example"}
        assert first_row["externalSlug"] == str(repo.external_id)

    def test_get_active_repos(self):
        repo1 = Repository.objects.create(
            name="getsentry/example",
            organization_id=self.org.id,
            external_id=12345,
            provider="dummy",
            config={"name": "getsentry/example"},
        )
        repo2 = Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.org.id,
            external_id=54321,
            provider="dummy",
            config={"name": "getsentry/sentry"},
        )

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        first_row = response.data[0]
        assert first_row["id"] == str(repo1.id)
        assert first_row["provider"] == {"id": "dummy", "name": "Example"}
        assert first_row["externalSlug"] == str(repo1.external_id)

        second_row = response.data[1]
        assert second_row["id"] == str(repo2.id)
        assert second_row["provider"] == {"id": "dummy", "name": "Example"}
        assert second_row["externalSlug"] == str(repo2.external_id)

    def test_get_exclude_hidden_repo(self):
        repo = Repository.objects.create(
            name="getsentry/example",
            organization_id=self.org.id,
            external_id=12345,
            provider="dummy",
            config={"name": "getsentry/example"},
        )
        Repository.objects.create(
            name="getsentry/sentry",
            organization_id=self.org.id,
            external_id=54321,
            provider="dummy",
            config={"name": "getsentry/sentry"},
            status=ObjectStatus.HIDDEN,
        )

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        first_row = response.data[0]
        assert first_row["id"] == str(repo.id)
        assert first_row["provider"] == {"id": "dummy", "name": "Example"}
        assert first_row["externalSlug"] == str(repo.external_id)

    def test_status_unmigratable(self):
        self.url = self.url + "?status=unmigratable"

        self.create_integration(
            organization=self.org,
            provider="github",
            external_id="github:1",
        )

        unmigratable_repo = Repository.objects.create(
            name="NotConnected/foo", organization_id=self.org.id
        )

        with patch(
            "sentry.integrations.github.GitHubIntegration.get_unmigratable_repositories"
        ) as f:
            f.return_value = [unmigratable_repo]

            response = self.client.get(self.url, format="json")

            assert response.status_code == 200, response.content
            assert response.data[0]["name"] == unmigratable_repo.name

    def test_status_unmigratable_missing_org_integration(self):
        self.url = self.url + "?status=unmigratable"

        self.create_integration(
            organization=self.create_organization(),
            provider="github",
            external_id="github:1",
        )

        unmigratable_repo = Repository.objects.create(
            name="NotConnected/foo", organization_id=self.org.id
        )

        with patch(
            "sentry.integrations.github.GitHubIntegration.get_unmigratable_repositories"
        ) as f:
            f.return_value = [unmigratable_repo]

            response = self.client.get(self.url, format="json")

            # Doesn't return anything when the OrganizatioIntegration doesn't
            # exist (the Integration has been disabled)
            assert response.status_code == 200, response.content
            assert len(response.data) == 0

    def test_status_unmigratable_disabled_integration(self):
        self.url = self.url + "?status=unmigratable"

        self.create_integration(
            organization=self.org,
            provider="github",
            external_id="github:1",
            status=ObjectStatus.DISABLED,
        )

        unmigratable_repo = Repository.objects.create(
            name="NotConnected/foo", organization_id=self.org.id
        )

        with patch(
            "sentry.integrations.github.GitHubIntegration.get_unmigratable_repositories"
        ) as f:
            f.return_value = [unmigratable_repo]

            response = self.client.get(self.url, format="json")

            assert response.status_code == 200

            # Shouldn't return the above "unmigratable repo" since the
            # Integration is disabled.
            assert len(response.data) == 0

            # Shouldn't even make the request to get repos
            assert not f.called

    def test_status_unmigratable_disabled_org_integration(self):
        self.url = self.url + "?status=unmigratable"
        self.create_integration(
            organization=self.org,
            provider="github",
            external_id="github:1",
            oi_params={"status": ObjectStatus.DISABLED},
        )

        unmigratable_repo = Repository.objects.create(
            name="NotConnected/foo", organization_id=self.org.id
        )

        with patch(
            "sentry.integrations.github.GitHubIntegration.get_unmigratable_repositories"
        ) as f:
            f.return_value = [unmigratable_repo]

            response = self.client.get(self.url, format="json")

            assert response.status_code == 200

            # Shouldn't return the above "unmigratable repo" since the
            # Integration is disabled.
            assert len(response.data) == 0

            # Shouldn't even make the request to get repos
            assert not f.called

    def test_passing_integration_id(self):
        integration = self.create_integration(
            organization=self.org,
            provider="github",
            external_id="github:1",
        )
        repo = Repository.objects.create(
            name="example", organization_id=self.org.id, integration_id=integration.id
        )
        integration2 = self.create_integration(
            organization=self.org,
            provider="github",
            external_id="github:2",
        )
        Repository.objects.create(
            name="example2", organization_id=self.org.id, integration_id=integration2.id
        )
        response = self.client.get(f"{self.url}?integration_id={integration.id}", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(repo.id)
        assert response.data[0]["externalSlug"] is None


@region_silo_test
class OrganizationRepositoriesCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        with patch.object(DummyRepositoryProvider, "needs_auth", return_value=False):
            url = reverse("sentry-api-0-organization-repositories", args=[org.slug])
            response = self.client.post(url, data={"provider": "dummy", "name": "getsentry/sentry"})

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data["id"]

        repo = Repository.objects.get(id=response.data["id"])
        assert repo.provider == "dummy"
        assert repo.name == "getsentry/sentry"

    def test_admin_ok(self):
        org = self.create_organization(owner=self.user, name="baz")
        team = self.create_team(name="people", organization=org)

        user = self.create_user(email="admin@example.org")
        self.create_member(organization=org, user=user, teams=[team], role="admin")

        self.login_as(user=user)

        with patch.object(DummyRepositoryProvider, "needs_auth", return_value=False):
            url = reverse("sentry-api-0-organization-repositories", args=[org.slug])
            response = self.client.post(url, data={"provider": "dummy", "name": "getsentry/sentry"})

        assert response.status_code == 201, (response.status_code, response.content)

    def test_member_ok(self):
        org = self.create_organization(owner=self.user, name="baz")
        team = self.create_team(name="people", organization=org)

        user = self.create_user(email="member@example.org")
        self.create_member(organization=org, user=user, teams=[team], role="member")

        self.login_as(user=user)

        with patch.object(DummyRepositoryProvider, "needs_auth", return_value=False):
            url = reverse("sentry-api-0-organization-repositories", args=[org.slug])
            response = self.client.post(url, data={"provider": "dummy", "name": "getsentry/sentry"})

        assert response.status_code == 201, (response.status_code, response.content)


@region_silo_test
class OrganizationIntegrationRepositoriesCreateTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integraiton = self.create_integration(
            organization=self.org, provider="example", external_id="example:1"
        )
        self.url = reverse("sentry-api-0-organization-repositories", args=[self.org.slug])
        self.login_as(user=self.user)
        self.repo_config_data = {
            "integration_id": self.integration.id,
            "external_id": "my_external_id",
            "name": "getsentry/sentry",
            "url": "https://github.com/getsentry/sentry",
            "config": {"name": "getsentry/sentry"},
        }

    @patch.object(
        ExampleRepositoryProvider, "get_repository_data", return_value={"my_config_key": "some_var"}
    )
    def test_simple(self, mock_build_repository_config):

        with patch.object(
            ExampleRepositoryProvider, "build_repository_config", return_value=self.repo_config_data
        ) as mock_get_repository_data:
            response = self.client.post(
                self.url, data={"provider": "integrations:example", "name": "getsentry/sentry"}
            )
            mock_get_repository_data.assert_called_once_with(
                organization=self.org, data={"my_config_key": "some_var"}
            )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data["id"]

        repo = Repository.objects.get(id=response.data["id"])
        assert repo.provider == "integrations:example"
        assert repo.name == "getsentry/sentry"
        assert repo.url == "https://github.com/getsentry/sentry"
        assert repo.config == {"name": "getsentry/sentry"}

    @patch.object(
        ExampleRepositoryProvider, "get_repository_data", return_value={"my_config_key": "some_var"}
    )
    def test_floating_repo(self, mock_build_repository_config):
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            status=2,
            external_id="my_external_id",
        )
        with patch.object(
            ExampleRepositoryProvider, "build_repository_config", return_value=self.repo_config_data
        ) as mock_get_repository_data:
            response = self.client.post(
                self.url, data={"provider": "integrations:example", "name": "getsentry/sentry"}
            )
            mock_get_repository_data.assert_called_once_with(
                organization=self.org, data={"my_config_key": "some_var"}
            )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data["id"]
        assert response.data["id"] == str(repo.id)

        repo = Repository.objects.get(id=response.data["id"])
        assert repo.provider == "integrations:example"
        assert repo.name == "getsentry/sentry"
        assert repo.url == "https://github.com/getsentry/sentry"
        assert repo.config == {"name": "getsentry/sentry"}
        assert repo.status == 0

    @patch.object(
        ExampleRepositoryProvider, "get_repository_data", return_value={"my_config_key": "some_var"}
    )
    def test_existing_repo(self, mock_build_repository_config):
        Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            status=0,
            external_id="my_external_id",
            integration_id="2",
            provider="integrations:example",
            url="https://github.com/getsentry/sentry",
        )

        with patch.object(
            ExampleRepositoryProvider, "build_repository_config", return_value=self.repo_config_data
        ) as mock_get_repository_data:
            response = self.client.post(
                self.url, data={"provider": "integrations:example", "name": "getsentry/sentry"}
            )
            mock_get_repository_data.assert_called_once_with(
                organization=self.org, data={"my_config_key": "some_var"}
            )

        assert response.status_code == 400
        assert (
            response.content
            == b'{"detail":{"code":"repo_exists","message":"A repository with that configuration already exists","extra":{}}}'
        )
