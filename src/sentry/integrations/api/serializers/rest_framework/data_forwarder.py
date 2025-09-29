import re
from collections.abc import MutableMapping
from typing import Any, TypedDict

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.models.project import Project


class SQSConfig(TypedDict):
    queue_url: str
    region: str
    access_key: str
    secret_key: str
    message_group_id: str | None
    s3_bucket: str | None


class SegmentConfig(TypedDict):
    write_key: str


class SplunkConfig(TypedDict):
    instance_URL: str
    index: str
    source: str
    token: str


class DataForwarderSerializer(Serializer):
    organization_id = serializers.IntegerField()
    is_enabled = serializers.BooleanField(default=True)
    enroll_new_projects = serializers.BooleanField(default=False)
    provider = serializers.ChoiceField(
        choices=[
            ("segment", "Segment"),
            ("sqs", "Amazon SQS"),
            ("splunk", "Splunk"),
        ]
    )
    config = serializers.JSONField(default=dict)

    def validate_config(self, config: dict) -> SQSConfig | SegmentConfig | SplunkConfig | dict:
        """Validate config based on provider."""
        provider = self.initial_data.get("provider")

        if provider == "sqs":
            return self._validate_sqs_config(config)
        elif provider == "segment":
            return self._validate_segment_config(config)
        elif provider == "splunk":
            return self._validate_splunk_config(config)

        return config

    def _validate_all_fields_present(
        self, config: dict, required_fields: list[str], provider_name: str = ""
    ) -> None:
        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            if provider_name:
                raise ValidationError(
                    f"Missing required {provider_name} fields: {', '.join(missing_fields)}"
                )
            else:
                raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")

    def _validate_sqs_queue_url(self, config: dict, errors: list[str]) -> None:
        queue_url = config.get("queue_url")
        sqs_url_pattern = (
            r"^https://sqs\.[a-z0-9\-]+\.amazonaws\.com/\d+/[a-zA-Z0-9\-_/]+(?:\.fifo)?$"
        )
        if not queue_url or not re.match(sqs_url_pattern, queue_url):
            errors.append(
                "queue_url must be a valid SQS URL format: "
                "https://sqs.region.amazonaws.com/account/queue-name"
            )

    def _validate_sqs_region(self, config: dict, errors: list[str]) -> None:
        aws_region_pattern = r"^[a-z0-9\-]+$"
        region = config.get("region")
        if not region or not re.match(aws_region_pattern, region):
            errors.append("region must be a valid AWS region format")

    def _validate_sqs_credentials(self, config: dict, errors: list[str]) -> None:
        access_key = config.get("access_key")
        secret_key = config.get("secret_key")

        if not access_key or access_key.strip() == "":
            errors.append("access_key must be a non-empty string")

        if not secret_key or secret_key.strip() == "":
            errors.append("secret_key must be a non-empty string")

    def _validate_sqs_message_group_id(self, config: dict, errors: list[str]) -> None:
        message_group_id = config.get("message_group_id")
        queue_url = config.get("queue_url")

        if message_group_id is not None and message_group_id.strip() == "":
            errors.append("message_group_id must be a non-empty string or null")

        if isinstance(queue_url, str) and queue_url.endswith(".fifo") and not message_group_id:
            errors.append("message_group_id is required for FIFO queues")

    def _validate_sqs_s3_bucket(self, config: dict, errors: list[str]) -> None:
        s3_bucket = config.get("s3_bucket")
        if s3_bucket is not None:
            if not s3_bucket or s3_bucket.strip() == "":
                errors.append("s3_bucket must be a non-empty string")
            else:
                s3_bucket_pattern = r"^[a-z0-9\-\.]+$"
                if not re.match(s3_bucket_pattern, s3_bucket):
                    errors.append("s3_bucket must be a valid S3 bucket name")

    def _validate_segment_write_key(self, config: dict) -> None:
        segment_write_key_pattern = r"^[a-zA-Z0-9_\-]+$"
        write_key = config.get("write_key")
        if not write_key or not re.match(segment_write_key_pattern, write_key):
            raise ValidationError("write_key must be a valid Segment write key format")

    def _validate_splunk_instance_url(self, config: dict, errors: list[str]) -> None:
        splunk_url_pattern = r"^https?://[a-zA-Z0-9\-\.]+(?::\d+)?(?:/.*)?$"
        instance_url = config.get("instance_URL")
        if not instance_url or not re.match(splunk_url_pattern, instance_url):
            errors.append("instance_URL must be a valid URL starting with http:// or https://")

    def _validate_splunk_required_strings(self, config: dict, errors: list[str]) -> None:
        index = config.get("index")
        if not index or index.strip() == "":
            errors.append("index must be a non-empty string")

        source = config.get("source")
        if not source or source.strip() == "":
            errors.append("source must be a non-empty string")

        token = config.get("token")
        if not token or token.strip() == "":
            errors.append("token must be a non-empty string")

    def _validate_splunk_token_format(self, config: dict, errors: list[str]) -> None:
        token = config.get("token")
        if token and token.strip():  # Only validate if token exists and is not empty
            splunk_token_pattern = r"^[a-zA-Z0-9\-]+$"
            if not re.match(splunk_token_pattern, token):
                errors.append("token must be a valid Splunk HEC token format")

    def validate(self, attrs: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        organization_id = attrs.get("organization_id")
        provider = attrs.get("provider")

        if organization_id and provider:
            existing = DataForwarder.objects.filter(
                organization_id=organization_id, provider=provider
            )

            if self.instance:
                existing = existing.exclude(id=self.instance.id)

            if existing.exists():
                raise ValidationError(
                    f"A DataForwarder with provider '{provider}' already exists for this organization."
                )

        return attrs

    def _validate_sqs_config(self, config: dict) -> SQSConfig:
        self._validate_all_fields_present(
            config, ["queue_url", "region", "access_key", "secret_key"], "SQS"
        )

        errors: list[str] = []
        self._validate_sqs_queue_url(config, errors)
        self._validate_sqs_region(config, errors)
        self._validate_sqs_credentials(config, errors)
        self._validate_sqs_message_group_id(config, errors)
        self._validate_sqs_s3_bucket(config, errors)

        if errors:
            raise ValidationError(errors)

        return config

    def _validate_segment_config(self, config: dict) -> SegmentConfig:
        self._validate_all_fields_present(config, ["write_key"], "Segment")
        self._validate_segment_write_key(config)
        return config

    def _validate_splunk_config(self, config: dict) -> SplunkConfig:
        self._validate_all_fields_present(
            config, ["instance_URL", "index", "source", "token"], "Splunk"
        )

        errors: list[str] = []
        self._validate_splunk_instance_url(config, errors)
        self._validate_splunk_required_strings(config, errors)
        self._validate_splunk_token_format(config, errors)

        if errors:
            raise ValidationError(errors)

        return config


class DataForwarderProjectSerializer(Serializer):
    data_forwarder_id = serializers.IntegerField()
    project_id = serializers.IntegerField()
    overrides = serializers.JSONField(default=dict)
    is_enabled = serializers.BooleanField(default=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._validated_data_forwarder = None
        self._validated_project = None

    def validate_data_forwarder_id(self, value: int) -> int:
        try:
            data_forwarder = DataForwarder.objects.get(id=value)
            self._validated_data_forwarder = data_forwarder
        except DataForwarder.DoesNotExist:
            raise ValidationError("DataForwarder with this ID does not exist")
        return value

    def validate_project_id(self, value: int) -> int:
        try:
            project = Project.objects.get(id=value)
            self._validated_project = project
        except Project.DoesNotExist:
            raise ValidationError("Project with this ID does not exist")
        return value

    def validate(self, attrs: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        data_forwarder_id = attrs.get("data_forwarder_id")
        project_id = attrs.get("project_id")

        if data_forwarder_id and project_id:
            if hasattr(self, "_validated_data_forwarder") and hasattr(self, "_validated_project"):
                data_forwarder = self._validated_data_forwarder
                project = self._validated_project

                if data_forwarder.organization_id != project.organization_id:
                    raise ValidationError(
                        "DataForwarder and Project must belong to the same organization."
                    )

            existing = DataForwarderProject.objects.filter(
                data_forwarder_id=data_forwarder_id, project_id=project_id
            )

            if self.instance:
                existing = existing.exclude(id=self.instance.id)

            if existing.exists():
                raise ValidationError(
                    "A DataForwarderProject already exists for this data forwarder and project combination."
                )

        return attrs
