from sentry.integrations.api.serializers.rest_framework.data_forwarder import (
    DataForwarderProjectSerializer,
    DataForwarderSerializer,
)
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.testutils.cases import TestCase
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
                "provider": "segment",
                "config": {"write_key": "test_key"},
            }
        )
        assert serializer.is_valid()
        validated_data = serializer.validated_data
        assert validated_data["organization_id"] == self.organization.id
        assert validated_data["is_enabled"] is True
        assert validated_data["enroll_new_projects"] is False
        assert validated_data["provider"] == "segment"
        assert validated_data["config"] == {"write_key": "test_key"}

    def test_default_values(self) -> None:
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
            }
        )
        assert serializer.is_valid()
        validated_data = serializer.validated_data
        assert validated_data["is_enabled"] is True  # default
        assert validated_data["enroll_new_projects"] is False  # default
        assert validated_data["config"] == {}  # default

    def test_required_fields(self) -> None:
        # Missing organization_id
        serializer = DataForwarderSerializer(data={"provider": "segment"})
        assert not serializer.is_valid()
        assert "organization_id" in serializer.errors

        # Missing provider
        serializer = DataForwarderSerializer(data={"organization_id": self.organization.id})
        assert not serializer.is_valid()
        assert "provider" in serializer.errors

    def test_provider_choice_validation(self) -> None:
        # Valid providers
        for provider in ["segment", "sqs", "splunk"]:
            serializer = DataForwarderSerializer(
                data={"organization_id": self.organization.id, "provider": provider}
            )
            assert serializer.is_valid(), f"Provider {provider} should be valid"

        # Invalid provider
        serializer = DataForwarderSerializer(
            data={"organization_id": self.organization.id, "provider": "invalid"}
        )
        assert not serializer.is_valid()
        assert "provider" in serializer.errors

    def test_organization_id_validation_valid(self) -> None:
        serializer = DataForwarderSerializer(
            data={"organization_id": self.organization.id, "provider": "segment"}
        )
        assert serializer.is_valid()
        assert serializer.validated_data["organization_id"] == self.organization.id

    def test_organization_id_validation_invalid(self) -> None:
        serializer = DataForwarderSerializer(data={"organization_id": 99999, "provider": "segment"})
        assert not serializer.is_valid()
        assert "organization_id" in serializer.errors
        assert "Organization with this ID does not exist" in str(
            serializer.errors["organization_id"]
        )

    def test_sqs_config_validation_valid(self) -> None:
        valid_config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": valid_config,
            }
        )
        assert serializer.is_valid()

    def test_sqs_config_validation_missing_required_fields(self) -> None:
        config = {"queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "Missing required SQS fields" in str(serializer.errors["config"])

    def test_sqs_config_validation_invalid_queue_url(self) -> None:
        config = {
            "queue_url": "invalid-url",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "queue_url must be a valid SQS URL format" in str(serializer.errors["config"])

    def test_sqs_config_validation_invalid_region(self) -> None:
        config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "invalid_region!",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "region must be a valid AWS region format" in str(serializer.errors["config"])

    def test_sqs_config_validation_empty_credentials(self) -> None:
        config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "",
            "secret_key": "   ",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        error_msg = str(serializer.errors["config"])
        assert "access_key must be a non-empty string" in error_msg
        assert "secret_key must be a non-empty string" in error_msg

    def test_sqs_config_validation_fifo_queue_without_message_group_id(self) -> None:
        config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue.fifo",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "message_group_id is required for FIFO queues" in str(serializer.errors["config"])

    def test_sqs_config_validation_fifo_queue_with_message_group_id(self) -> None:
        config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue.fifo",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "message_group_id": "test-group",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert serializer.is_valid()

    def test_sqs_config_validation_s3_bucket_valid(self) -> None:
        config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "s3_bucket": "my-bucket-name",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert serializer.is_valid()

    def test_sqs_config_validation_s3_bucket_invalid(self) -> None:
        config = {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "region": "us-east-1",
            "access_key": "AKIAIOSFODNN7EXAMPLE",
            "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "s3_bucket": "invalid_bucket_name!",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "s3_bucket must be a valid S3 bucket name" in str(serializer.errors["config"])

    def test_segment_config_validation_valid(self) -> None:
        config = {"write_key": "test_write_key_123"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "segment",
                "config": config,
            }
        )
        assert serializer.is_valid()

    def test_segment_config_validation_missing_write_key(self) -> None:
        config = {}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "segment",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "Missing required Segment fields: write_key" in str(serializer.errors["config"])

    def test_segment_config_validation_invalid_write_key_format(self) -> None:
        config = {"write_key": "invalid key with spaces!"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "segment",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "write_key must be a valid Segment write key format" in str(
            serializer.errors["config"]
        )

    def test_splunk_config_validation_valid(self) -> None:
        config = {
            "instance_URL": "https://splunk.example.com:8089",
            "index": "main",
            "source": "sentry",
            "token": "12345678-1234-1234-1234-123456789abc",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "splunk",
                "config": config,
            }
        )
        assert serializer.is_valid()

    def test_splunk_config_validation_missing_required_fields(self) -> None:
        config = {"instance_URL": "https://splunk.example.com:8089"}
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "splunk",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "Missing required Splunk fields" in str(serializer.errors["config"])

    def test_splunk_config_validation_invalid_url(self) -> None:
        config = {
            "instance_URL": "invalid-url",
            "index": "main",
            "source": "sentry",
            "token": "12345678-1234-1234-1234-123456789abc",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "splunk",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "instance_URL must be a valid URL starting with http:// or https://" in str(
            serializer.errors["config"]
        )

    def test_splunk_config_validation_empty_strings(self) -> None:
        config = {
            "instance_URL": "https://splunk.example.com:8089",
            "index": "",
            "source": "   ",
            "token": "12345678-1234-1234-1234-123456789abc",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "splunk",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        error_msg = str(serializer.errors["config"])
        assert "index must be a non-empty string" in error_msg
        assert "source must be a non-empty string" in error_msg

    def test_splunk_config_validation_invalid_token_format(self) -> None:
        config = {
            "instance_URL": "https://splunk.example.com:8089",
            "index": "main",
            "source": "sentry",
            "token": "invalid token with spaces!",
        }
        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "splunk",
                "config": config,
            }
        )
        assert not serializer.is_valid()
        assert "config" in serializer.errors
        assert "token must be a valid Splunk HEC token format" in str(serializer.errors["config"])

    def test_uniqueness_validation_duplicate_organization_provider(self) -> None:
        DataForwarder.objects.create(
            organization=self.organization,
            provider="segment",
            config={"write_key": "existing_key"},
        )

        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "segment",
                "config": {"write_key": "new_key"},
            }
        )
        assert not serializer.is_valid()
        assert "non_field_errors" in serializer.errors
        assert (
            "A DataForwarder with provider 'segment' already exists for this organization"
            in str(serializer.errors["non_field_errors"])
        )

    def test_uniqueness_validation_update_existing(self) -> None:
        data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider="segment",
            config={"write_key": "existing_key"},
        )

        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "segment",
                "config": {"write_key": "updated_key"},
            },
            instance=data_forwarder,
        )
        assert serializer.is_valid()

    def test_uniqueness_validation_different_providers(self) -> None:
        DataForwarder.objects.create(
            organization=self.organization,
            provider="segment",
            config={"write_key": "existing_key"},
        )

        serializer = DataForwarderSerializer(
            data={
                "organization_id": self.organization.id,
                "provider": "sqs",
                "config": {
                    "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
                    "region": "us-east-1",
                    "access_key": "AKIAIOSFODNN7EXAMPLE",
                    "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                },
            }
        )
        assert serializer.is_valid()


@region_silo_test
class DataForwarderProjectSerializerTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider="segment",
            config={"write_key": "test_key"},
        )

    def test_basic_field_validation(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
                "overrides": {"custom_setting": "value"},
                "is_enabled": True,
            }
        )
        assert serializer.is_valid()
        validated_data = serializer.validated_data
        assert validated_data["data_forwarder_id"] == self.data_forwarder.id
        assert validated_data["project_id"] == self.project.id
        assert validated_data["overrides"] == {"custom_setting": "value"}
        assert validated_data["is_enabled"] is True

    def test_default_values(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
            }
        )
        assert serializer.is_valid()
        validated_data = serializer.validated_data
        assert validated_data["overrides"] == {}  # default
        assert validated_data["is_enabled"] is True  # default

    def test_required_fields(self) -> None:
        # Missing data_forwarder_id
        serializer = DataForwarderProjectSerializer(data={"project_id": self.project.id})
        assert not serializer.is_valid()
        assert "data_forwarder_id" in serializer.errors

        # Missing project_id
        serializer = DataForwarderProjectSerializer(
            data={"data_forwarder_id": self.data_forwarder.id}
        )
        assert not serializer.is_valid()
        assert "project_id" in serializer.errors

    def test_data_forwarder_id_validation_valid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
            }
        )
        assert serializer.is_valid()
        assert serializer.validated_data["data_forwarder_id"] == self.data_forwarder.id

    def test_data_forwarder_id_validation_invalid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={"data_forwarder_id": 99999, "project_id": self.project.id}
        )
        assert not serializer.is_valid()
        assert "data_forwarder_id" in serializer.errors
        assert "DataForwarder with this ID does not exist" in str(
            serializer.errors["data_forwarder_id"]
        )

    def test_project_id_validation_valid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
            }
        )
        assert serializer.is_valid()
        assert serializer.validated_data["project_id"] == self.project.id

    def test_project_id_validation_invalid(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={"data_forwarder_id": self.data_forwarder.id, "project_id": 99999}
        )
        assert not serializer.is_valid()
        assert "project_id" in serializer.errors
        assert "Project with this ID does not exist" in str(serializer.errors["project_id"])

    def test_uniqueness_validation_duplicate_combination(self) -> None:
        DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
        )

        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
            }
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
                "project_id": self.project.id,
                "is_enabled": False,
            },
            instance=data_forwarder_project,
        )
        assert serializer.is_valid()

    def test_uniqueness_validation_different_combinations(self) -> None:
        project2 = self.create_project(organization=self.organization)

        data_forwarder2 = DataForwarder.objects.create(
            organization=self.organization,
            provider="sqs",
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

        # valid combos
        valid_combinations = [
            (self.data_forwarder, project2),  # same forwarder, different project
            (data_forwarder2, self.project),  # different forwarder, same project
            (data_forwarder2, project2),  # different forwarder, different project
        ]

        for data_forwarder, project in valid_combinations:
            serializer = DataForwarderProjectSerializer(
                data={
                    "data_forwarder_id": data_forwarder.id,
                    "project_id": project.id,
                }
            )
            assert (
                serializer.is_valid()
            ), f"Combination {data_forwarder.id}, {project.id} should be valid"

    def test_json_field_validation(self) -> None:
        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
                "overrides": {"key": "value", "nested": {"inner": "data"}},
            }
        )
        assert serializer.is_valid()

        serializer = DataForwarderProjectSerializer(
            data={
                "data_forwarder_id": self.data_forwarder.id,
                "project_id": self.project.id,
                "overrides": {},
            }
        )
        assert serializer.is_valid()
