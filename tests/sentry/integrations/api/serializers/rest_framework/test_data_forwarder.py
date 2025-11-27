from typing import Any

from sentry.auth.access import from_request
from sentry.integrations.api.serializers.rest_framework.data_forwarder import (
    DataForwarderProjectSerializer,
    DataForwarderSerializer,
)
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DataForwarderSerializerTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    def test_basic_field_validation(self) -> None:
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "is_enabled": True,
                "enroll_new_projects": False,
                "provider": DataForwarderProviderSlug.SEGMENT,
                "config": {"write_key": "test_key"},
                "project_ids": [],
            }
        )
        assert serializer.is_valid()
        validated_data: dict[str, Any] = serializer.validated_data
        assert validated_data["organization_id"] == self.organization.id
        assert validated_data["is_enabled"] is True
        assert validated_data["enroll_new_projects"] is False
        assert validated_data["provider"] == DataForwarderProviderSlug.SEGMENT
        assert validated_data["config"] == {"write_key": "test_key"}
        assert validated_data["project_ids"] == []

    def test_default_values(self) -> None:
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": {
                    "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                    "region": "us-east-1",
                    "access_key": "AKIAIOSFODNN7EXAMPLE",
                    "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                },
                "project_ids": [],
            }
        )
        assert serializer.is_valid()
        validated_data: dict[str, Any] = serializer.validated_data
        assert validated_data["is_enabled"] is True  # default
        assert validated_data["enroll_new_projects"] is False  # default

    def test_required_fields(self) -> None:
        # Missing organization_id
        serializer = DataForwarderSerializer(data={"provider": DataForwarderProviderSlug.SEGMENT})
        assert not serializer.is_valid()
        assert "organization_id" in serializer.errors

        # Missing provider
        serializer = DataForwarderSerializer(data={"organization_id": self.organization.id})
        assert not serializer.is_valid()
        assert "provider" in serializer.errors

    def test_provider_choice_validation(self) -> None:
        # Valid providers
        provider_configs = {
            DataForwarderProviderSlug.SEGMENT: {"write_key": "test_key"},
            DataForwarderProviderSlug.SQS: {
                "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                "region": "us-east-1",
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
            DataForwarderProviderSlug.SPLUNK: {
                "instance_url": "https://splunk.example.com:8089",
                "index": "main",
                "source": "sentry",
                "token": "12345678-1234-1234-1234-123456789abc",
            },
        }

        for provider, config in provider_configs.items():
            serializer = DataForwarderSerializer(
                data={
                    "organization_id": self.organization.id,
                    "provider": provider,
                    "config": config,
                    "project_ids": [],
                }
            )
            assert serializer.is_valid(), f"Provider {provider} should be valid"

        # Invalid provider
        serializer = DataForwarderSerializer(
            data={"organization_id": self.organization.id, "provider": "invalid"}
        )
        assert not serializer.is_valid()
        assert "provider" in serializer.errors

    def test_sqs_config_validation_valid(self) -> None:
        valid_config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": valid_config,
                "project_ids": [],
            }
        )
        assert serializer.is_valid()

    def test_sqs_config_validation_missing_required_fields(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue"
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "Missing required sqs fields" in str(serializer.errors["config"])

    def test_sqs_config_validation_invalid_queue_url(self) -> None:
        config: dict[str, str] = {
            "queue_url": "invalid-url",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "queue_url must be a valid SQS URL format" in str(serializer.errors["config"])

    def test_sqs_config_validation_invalid_region(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "invalid_region!",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "region must be a valid AWS region" in str(serializer.errors["config"])

    def test_sqs_config_validation_valid_regions(self) -> None:
        """Test that actual AWS regions are accepted."""
        from sentry_plugins.amazon_sqs.plugin import get_regions

        valid_regions = get_regions()
        # Test with a few known regions
        test_regions = ["us-east-1", "us-west-2", "eu-west-1"]

        for region in test_regions:
            if region in valid_regions:  # Only test if the region is actually available
                config: dict[str, str] = {
                    "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                    "region": region,
                    "access_key": "AKIAIOSFODNN7EXAMPLE",
                    "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                }
                serializer = DataForwarderSerializer(
                    data={
                        "organization_id": self.organization.id,
                        "provider": DataForwarderProviderSlug.SQS,
                        "config": config,
                        "project_ids": [],
                    }
                )
                assert serializer.is_valid(), f"Region {region} should be valid"

    def test_sqs_config_validation_empty_credentials(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": " ",
            "secret_key": "   ",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        config_errors_str = str(serializer.errors["config"])
        assert "access_key" in config_errors_str and "secret_key" in config_errors_str

    def test_sqs_config_validation_fifo_queue_without_message_group_id(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue.fifo",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "message_group_id is required for FIFO queues" in str(serializer.errors["config"])

    def test_sqs_config_validation_fifo_queue_with_message_group_id(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue.fifo",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "message_group_id": "test-group",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert serializer.is_valid()

    def test_sqs_config_validation_s3_bucket_valid(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "s3_bucket": "my-bucket-name",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert serializer.is_valid()

    def test_sqs_config_validation_s3_bucket_invalid(self) -> None:
        config: dict[str, str] = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "s3_bucket": "invalid_bucket_name!",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "s3_bucket must be a valid S3 bucket name" in str(serializer.errors["config"])

    def test_segment_config_validation_valid(self) -> None:
        config: dict[str, str] = {"write_key": "test_write_key_123"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SEGMENT,
                "config": config,
                "project_ids": [],
            }
        )
        assert serializer.is_valid()

    def test_segment_config_validation_missing_write_key(self) -> None:
        config: dict[str, str] = {}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SEGMENT,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "Missing required segment fields: write_key" in str(serializer.errors["config"])

    def test_segment_config_validation_invalid_write_key_format(self) -> None:
        config: dict[str, str] = {"write_key": "invalid key with spaces!"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SEGMENT,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "write_key must be a valid Segment write key format" in str(
            serializer.errors["config"]
        )

    def test_splunk_config_validation_valid(self) -> None:
        config: dict[str, str] = {
            "instance_url": "https://splunk.example.com:8089",
            "index": "main",
            "source": "sentry",
            "token": "12345678-1234-1234-1234-123456789abc",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SPLUNK,
                "config": config,
                "project_ids": [],
            }
        )
        assert serializer.is_valid()

    def test_splunk_config_validation_missing_required_fields(self) -> None:
        config: dict[str, str] = {"instance_url": "https://splunk.example.com:8089"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SPLUNK,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "Missing required splunk fields" in str(serializer.errors["config"])

    def test_splunk_config_validation_invalid_url(self) -> None:
        config: dict[str, str] = {
            "instance_url": "invalid-url",
            "index": "main",
            "source": "sentry",
            "token": "12345678-1234-1234-1234-123456789abc",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SPLUNK,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "instance_url must be a valid URL starting with http:// or https://" in str(
            serializer.errors["config"]
        )

    def test_splunk_config_validation_empty_strings(self) -> None:
        config: dict[str, str] = {
            "instance_url": "https://splunk.example.com:8089",
            "index": "",
            "source": "   ",
            "token": "12345678-1234-1234-1234-123456789abc",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SPLUNK,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        config_errors_str = str(serializer.errors["config"])
        assert "index" in config_errors_str and "source" in config_errors_str

    def test_splunk_config_validation_invalid_token_format(self) -> None:
        config: dict[str, str] = {
            "instance_url": "https://splunk.example.com:8089",
            "index": "main",
            "source": "sentry",
            "token": "invalid token with spaces!",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SPLUNK,
                "config": config,
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "token must be a valid Splunk HEC token format" in str(serializer.errors["config"])

    def test_uniqueness_validation_duplicate_organization_provider(self) -> None:
        DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "existing_key"},
        )

        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SEGMENT,
                "config": {"write_key": "new_key"},
                "project_ids": [],
            }
        )
        assert not serializer.is_valid()
        assert "non_field_errors" in serializer.errors
        assert (
            f"A DataForwarder with provider '{DataForwarderProviderSlug.SEGMENT}' already exists for this organization"
            in str(serializer.errors["non_field_errors"])
        )

    def test_uniqueness_validation_update_existing(self) -> None:
        data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "existing_key"},
        )

        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SEGMENT,
                "config": {"write_key": "updated_key"},
                "project_ids": [],
            },
            instance=data_forwarder,
        )
        assert serializer.is_valid()

    def test_uniqueness_validation_different_providers(self) -> None:
        DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "existing_key"},
        )

        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": DataForwarderProviderSlug.SQS,
                "config": {
                    "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                    "region": "us-east-1",
                    "access_key": "AKIAIOSFODNN7EXAMPLE",
                    "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                },
                "project_ids": [],
            }
        )
        assert serializer.is_valid()


@region_silo_test
class DataForwarderProjectSerializerTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )
        self.create_member(user=self.user, organization=self.organization, role="owner")
        self.create_team_membership(user=self.user, team=self.team)

    def get_serializer_context(self) -> dict[str, Any]:
        request = self.make_request(user=self.user)
        drf_request = drf_request_from_request(request)
        access = from_request(drf_request, self.organization)
        return {
            "organization": self.organization,
            "access": access,
        }

    def test_basic_field_validation(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
                "overrides": {"custom_setting": "value"},
                "is_enabled": True,
            },
            context=self.get_serializer_context(),
        )
        assert serializer.is_valid(), f"Validation failed with errors: {serializer.errors}"
        validated_data: dict[str, Any] = serializer.validated_data
        assert validated_data["data_forwarder_id"] == self.data_forwarder.id
        assert validated_data["project"] == self.project
        assert validated_data["overrides"] == {"custom_setting": "value"}
        assert validated_data["is_enabled"] is True

    def test_default_values(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
            },
            context=self.get_serializer_context(),
        )
        assert serializer.is_valid(), f"Validation failed with errors: {serializer.errors}"
        validated_data = serializer.validated_data
        assert validated_data["overrides"] == {}  # default
        assert validated_data["is_enabled"] is True  # default

    def test_required_fields(self) -> None:
        # Missing data_forwarder_id
        serializer = DataForwarderProjectSerializer(
            data={"project": self.project.id},
            context=self.get_serializer_context(),
        )
        assert not serializer.is_valid()
        assert "data_forwarder_id" in serializer.errors

        # Missing project
        serializer = DataForwarderProjectSerializer(
            data={"data_forwarder_id": self.data_forwarder.id},
            context=self.get_serializer_context(),
        )
        assert not serializer.is_valid()
        assert "project" in serializer.errors

    def test_data_forwarder_id_validation_valid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
            },
            context=self.get_serializer_context(),
        )
        assert serializer.is_valid(), f"Validation failed with errors: {serializer.errors}"
        assert serializer.validated_data["data_forwarder_id"] == self.data_forwarder.id

    def test_data_forwarder_id_validation_invalid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={"data_forwarder_id": 99999, "project": self.project.id},
            context=self.get_serializer_context(),
        )
        assert not serializer.is_valid()
        assert "data_forwarder_id" in serializer.errors
        assert "DataForwarder with this ID does not exist" in str(
            serializer.errors["data_forwarder_id"]
        )

    def test_data_forwarder_id_validation_wrong_organization(self) -> None:
        """Test IDOR protection: cannot access DataForwarder from different organization"""
        # Create a different organization with its own data forwarder
        other_org = self.create_organization()
        other_data_forwarder = DataForwarder.objects.create(
            organization=other_org,
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "other_key"},
        )

        # Try to use data_forwarder from other organization (IDOR attempt)
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": other_data_forwarder.id,
                "project": self.project.id,
            },
            context=self.get_serializer_context(),
        )
        assert not serializer.is_valid()
        assert "data_forwarder_id" in serializer.errors
        assert "DataForwarder with this ID does not exist" in str(
            serializer.errors["data_forwarder_id"]
        )

    def test_project_validation_valid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
            },
            context=self.get_serializer_context(),
        )
        assert serializer.is_valid(), f"Validation failed with errors: {serializer.errors}"
        assert serializer.validated_data["project"] == self.project

    def test_project_validation_invalid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={"data_forwarder_id": self.data_forwarder.id, "project": 99999},
            context=self.get_serializer_context(),
        )
        assert not serializer.is_valid()
        assert "project" in serializer.errors
        assert "Invalid project" in str(serializer.errors["project"])

    def test_uniqueness_validation_duplicate_combination(self) -> None:
        DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
        )

        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
            },
            context=self.get_serializer_context(),
        )
        assert not serializer.is_valid()
        assert "non_field_errors" in serializer.errors
        assert (
            "A DataForwarderProject already exists for this data forwarder and project combination"
            in str(serializer.errors["non_field_errors"])
        )

    def test_uniqueness_validation_update_existing(self) -> None:
        data_forwarder_project = DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
        )

        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
                "is_enabled": False,
            },
            context=self.get_serializer_context(),
            instance=data_forwarder_project,
        )
        assert serializer.is_valid()

    def test_uniqueness_validation_different_combinations(self) -> None:
        project2 = self.create_project(organization=self.organization, teams=[self.team])

        data_forwarder2 = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SQS,
            config={
                "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                "region": "us-east-1",
                "access_key": "AKIAIOSFODNN7EXAMPLE",
                "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            },
        )

        DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
        )

        # Valid combos
        valid_combinations = [
            (self.data_forwarder, project2),  # same forwarder, different project
            (data_forwarder2, self.project),  # different forwarder, same project
            (data_forwarder2, project2),  # different forwarder, different project
        ]

        for data_forwarder, project in valid_combinations:
            serializer = DataForwarderProjectSerializer(
                data={
                    "data_forwarder_id": data_forwarder.id,
                    "project": project.id,
                },
                context=self.get_serializer_context(),
            )
            assert serializer.is_valid(), (
                f"Combination {data_forwarder.id}, {project.id} should be valid. "
                f"Errors: {serializer.errors}"
            )

    def test_json_field_validation(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
                "overrides": {"key": "value", "nested": {"inner": "data"}},
            },
            context=self.get_serializer_context(),
        )
        assert serializer.is_valid()

        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project": self.project.id,
                "overrides": {},
            },
            context=self.get_serializer_context(),
        )
        assert serializer.is_valid()
