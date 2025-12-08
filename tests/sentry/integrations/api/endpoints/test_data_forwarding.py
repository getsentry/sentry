from django.urls import reverse

from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DataForwardingIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-forwarding"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def get_response(self, *args, **kwargs):
        """
        Override get_response to always add the required feature flag.
        """
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": True,
                "organizations:data-forwarding": True,
            }
        ):
            return super().get_response(*args, **kwargs)


@region_silo_test
class DataForwardingIndexGetTest(DataForwardingIndexEndpointTest):

    def test_without_revamp_feature_flag_access(self) -> None:
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": False,
                "organizations:data-forwarding": True,
            }
        ):
            response = self.client.get(reverse(self.endpoint, args=(self.organization.slug,)))
            assert response.status_code == 403

    def test_without_data_forwarding_feature_flag_access(self) -> None:
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": True,
                "organizations:data-forwarding": False,
            }
        ):
            response = self.client.get(reverse(self.endpoint, args=(self.organization.slug,)))
            assert response.status_code == 200

    def test_get_single_data_forwarder(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
            is_enabled=True,
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(data_forwarder.id)
        assert response.data[0]["provider"] == DataForwarderProviderSlug.SEGMENT
        assert response.data[0]["config"] == {"write_key": "test_key"}
        assert response.data[0]["isEnabled"] is True

    def test_get_multiple_data_forwarders(self) -> None:
        segment_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "segment_key"},
        )
        sqs_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SQS,
            config={
                "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                "region": "us-east-1",
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 2

        forwarder_ids = [f["id"] for f in response.data]
        assert str(segment_forwarder.id) in forwarder_ids
        assert str(sqs_forwarder.id) in forwarder_ids

    def test_get_data_forwarder_with_project_configs(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        project_config1 = self.create_data_forwarder_project(
            data_forwarder=data_forwarder,
            project=project1,
            is_enabled=True,
            overrides={"custom": "value1"},
        )
        project_config2 = self.create_data_forwarder_project(
            data_forwarder=data_forwarder,
            project=project2,
            is_enabled=False,
            overrides={"custom": "value2"},
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1

        project_configs = response.data[0]["projectConfigs"]
        assert len(project_configs) == 2

        project_config_ids = [pc["id"] for pc in project_configs]
        assert str(project_config1.id) in project_config_ids
        assert str(project_config2.id) in project_config_ids

    def test_get_only_returns_organization_data_forwarders(self) -> None:
        my_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "my_key"},
        )

        other_org = self.create_organization()
        self.create_data_forwarder(
            organization=other_org,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "other_key"},
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(my_forwarder.id)

    def test_get_requires_read_permission(self) -> None:
        user_without_permission = self.create_user()
        self.login_as(user=user_without_permission)

        self.get_error_response(self.organization.slug, status_code=403)

    def test_get_with_disabled_data_forwarder(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
            is_enabled=False,
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(data_forwarder.id)
        assert response.data[0]["isEnabled"] is False


@region_silo_test
class DataForwardingIndexPostTest(DataForwardingIndexEndpointTest):
    method = "POST"

    def test_without_revamp_feature_flag_access(self) -> None:
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": False,
                "organizations:data-forwarding": True,
            }
        ):
            response = self.client.post(reverse(self.endpoint, args=(self.organization.slug,)))
            assert response.status_code == 403

    def test_without_data_forwarding_feature_flag_access(self) -> None:
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": True,
                "organizations:data-forwarding": False,
            }
        ):
            response = self.client.post(reverse(self.endpoint, args=(self.organization.slug,)))
            assert response.status_code == 403

    def test_create_segment_data_forwarder(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_segment_key"},
            "is_enabled": True,
            "enroll_new_projects": False,
            "project_ids": [],
        }

        response = self.get_success_response(self.organization.slug, status_code=201, **payload)

        assert response.data["provider"] == DataForwarderProviderSlug.SEGMENT
        assert response.data["config"] == {"write_key": "test_segment_key"}
        assert response.data["isEnabled"] is True
        assert response.data["enrollNewProjects"] is False

        data_forwarder = DataForwarder.objects.get(id=response.data["id"])
        assert data_forwarder.organization_id == self.organization.id
        assert data_forwarder.provider == DataForwarderProviderSlug.SEGMENT
        assert data_forwarder.config == {"write_key": "test_segment_key"}

    def test_create_sqs_data_forwarder(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SQS,
            "config": {
                "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                "region": "us-east-1",
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
            "project_ids": [],
        }

        response = self.get_success_response(self.organization.slug, status_code=201, **payload)

        assert response.data["provider"] == DataForwarderProviderSlug.SQS

        data_forwarder = DataForwarder.objects.get(id=response.data["id"])
        assert data_forwarder.provider == DataForwarderProviderSlug.SQS

    def test_create_splunk_data_forwarder(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SPLUNK,
            "config": {
                "instance_url": "https://splunk.example.com:8089",
                "index": "main",
                "source": "sentry",
                "token": "12345678-1234-1234-1234-123456789abc",
            },
            "project_ids": [],
        }

        response = self.get_success_response(self.organization.slug, status_code=201, **payload)

        assert response.data["provider"] == DataForwarderProviderSlug.SPLUNK

        data_forwarder = DataForwarder.objects.get(id=response.data["id"])
        assert data_forwarder.provider == DataForwarderProviderSlug.SPLUNK

    def test_create_with_default_values(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [],
        }

        response = self.get_success_response(self.organization.slug, status_code=201, **payload)

        assert response.data["isEnabled"] is True
        assert response.data["enrollNewProjects"] is False

    def test_create_duplicate_provider_fails(self) -> None:
        self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "existing_key"},
        )

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "new_key"},
            "project_ids": [],
        }

        response = self.get_error_response(self.organization.slug, status_code=400, **payload)

        assert "already exists" in str(response.data).lower()

    def test_create_different_providers_succeeds(self) -> None:
        self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "segment_key"},
        )

        payload = {
            "provider": DataForwarderProviderSlug.SQS,
            "config": {
                "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                "region": "us-east-1",
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
            "project_ids": [],
        }

        response = self.get_success_response(self.organization.slug, status_code=201, **payload)

        assert response.data["provider"] == DataForwarderProviderSlug.SQS

    def test_create_missing_required_fields(self) -> None:
        payload = {
            "config": {"write_key": "test_key"},
        }
        response = self.get_error_response(self.organization.slug, status_code=400, **payload)
        assert "provider" in str(response.data).lower()

    def test_create_invalid_config(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "invalid key"},
            "project_ids": [],
        }
        response = self.get_error_response(self.organization.slug, status_code=400, **payload)
        assert "config" in str(response.data).lower()

    def test_create_requires_write_permission(self) -> None:
        user_without_permission = self.create_user()
        self.login_as(user=user_without_permission)

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [],
        }

        self.get_error_response(self.organization.slug, status_code=403, **payload)

    def test_create_invalid_provider(self) -> None:
        payload = {
            "provider": "invalid_provider",
            "config": {"write_key": "test_key"},
            "project_ids": [],
        }

        response = self.get_error_response(self.organization.slug, status_code=400, **payload)
        assert "provider" in str(response.data).lower()

    def test_create_duplicate_provider_returns_error(self) -> None:
        self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "existing_key"},
        )

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "new_key"},
            "project_ids": [],
        }
        response = self.get_error_response(self.organization.slug, status_code=400, **payload)
        assert "already exists" in str(response.data).lower()

    def test_create_missing_config(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
        }

        response = self.get_error_response(self.organization.slug, status_code=400, **payload)
        assert "config" in str(response.data).lower()

    def test_create_without_project_ids(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
        }

        response = self.get_success_response(self.organization.slug, status_code=201, **payload)
        assert response.data["provider"] == DataForwarderProviderSlug.SEGMENT

        data_forwarder = DataForwarder.objects.get(id=response.data["id"])
        assert data_forwarder.projects.count() == 0

    def test_create_sqs_fifo_queue_validation(self) -> None:
        payload = {
            "provider": DataForwarderProviderSlug.SQS,
            "config": {
                "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue.fifo",
                "region": "us-east-1",
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
            "project_ids": [],
        }

        response = self.get_error_response(self.organization.slug, status_code=400, **payload)
        assert "message_group_id" in str(response.data).lower()
