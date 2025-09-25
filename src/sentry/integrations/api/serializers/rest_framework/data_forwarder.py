import re
from collections.abc import MutableMapping
from typing import Any

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.models.organization import Organization
from sentry.models.project import Project


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

    def validate_organization_id(self, value: int) -> int:
        try:
            Organization.objects.get(id=value)
        except Organization.DoesNotExist:
            raise ValidationError("Organization with this ID does not exist")
        return value

    def validate_config(self, value: dict) -> dict:
        provider = self.initial_data.get("provider") or getattr(self.instance, "provider", None)

        if provider == "sqs":
            return self._validate_sqs_config(value)
        elif provider == "segment":
            return self._validate_segment_config(value)
        elif provider == "splunk":
            return self._validate_splunk_config(value)

        return value

    def _validate_sqs_config(self, config: dict) -> dict:
        """Validate Amazon SQS specific configuration."""
        required_fields = ["queue_url", "region", "access_key", "secret_key"]
        # optional_fields = ["message_group_id", "s3_bucket"]

        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            raise ValidationError(f"Missing required SQS fields: {', '.join(missing_fields)}")

        errors = []

        # SQS URL format: https://sqs.region.amazonaws.com/account/queue-name
        queue_url = config.get("queue_url")
        sqs_url_pattern = (
            r"^https://sqs\.[a-z0-9\-]+\.amazonaws\.com/\d+/[a-zA-Z0-9\-_/]+(?:\.fifo)?$"
        )
        if not isinstance(queue_url, str) or not re.match(sqs_url_pattern, queue_url):
            errors.append(
                "queue_url must be a valid SQS URL format: "
                "https://sqs.region.amazonaws.com/account/queue-name"
            )

        aws_region_pattern = r"^[a-z0-9\-]+$"
        region = config.get("region")
        if not isinstance(region, str) or not re.match(aws_region_pattern, region):
            errors.append("region must be a valid AWS region format")

        access_key = config.get("access_key")
        secret_key = config.get("secret_key")

        if not isinstance(access_key, str) or access_key.strip() == "":
            errors.append("access_key must be a non-empty string")

        if not isinstance(secret_key, str) or secret_key.strip() == "":
            errors.append("secret_key must be a non-empty string")

        message_group_id = config.get("message_group_id")
        if message_group_id is not None and not isinstance(message_group_id, str):
            errors.append("message_group_id must be a string or null")

        if isinstance(queue_url, str) and queue_url.endswith(".fifo") and not message_group_id:
            errors.append("message_group_id is required for FIFO queues")

        s3_bucket = config.get("s3_bucket")
        if s3_bucket is not None:
            if not isinstance(s3_bucket, str) or s3_bucket.strip() == "":
                errors.append("s3_bucket must be a non-empty string")
            else:
                s3_bucket_pattern = r"^[a-z0-9\-\.]+$"
                if not re.match(s3_bucket_pattern, s3_bucket):
                    errors.append("s3_bucket must be a valid S3 bucket name")

        if errors:
            raise ValidationError(errors)

        return config

    def _validate_segment_config(self, config: dict) -> dict:
        if "write_key" not in config:
            raise ValidationError("Missing required Segment fields: write_key")

        segment_write_key_pattern = r"^[a-zA-Z0-9_\-]+$"
        write_key = config.get("write_key")
        if not isinstance(write_key, str) or not re.match(segment_write_key_pattern, write_key):
            raise ValidationError("write_key must be a valid Segment write key format")

        return config

    def _validate_splunk_config(self, config: dict) -> dict:
        required_fields = ["instance_URL", "index", "source", "token"]

        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            raise ValidationError(f"Missing required Splunk fields: {', '.join(missing_fields)}")

        errors = []

        splunk_url_pattern = r"^https?://[a-zA-Z0-9\-\.]+(?::\d+)?(?:/.*)?$"
        instance_url = config.get("instance_URL")
        if not isinstance(instance_url, str) or not re.match(splunk_url_pattern, instance_url):
            errors.append("instance_URL must be a valid URL starting with http:// or https://")

        index = config.get("index")
        if not isinstance(index, str) or index.strip() == "":
            errors.append("index must be a non-empty string")

        source = config.get("source")
        if not isinstance(source, str) or source.strip() == "":
            errors.append("source must be a non-empty string")

        token = config.get("token")
        if not isinstance(token, str) or token.strip() == "":
            errors.append("token must be a non-empty string")
        else:
            splunk_token_pattern = r"^[a-zA-Z0-9\-]+$"
            if not re.match(splunk_token_pattern, token):
                errors.append("token must be a valid Splunk HEC token format")

        if errors:
            raise ValidationError(errors)

        return config

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


class DataForwarderProjectSerializer(Serializer):
    data_forwarder_id = serializers.IntegerField()
    project_id = serializers.IntegerField()
    overrides = serializers.JSONField(default=dict)
    is_enabled = serializers.BooleanField(default=True)

    def validate_data_forwarder_id(self, value: int) -> int:
        try:
            DataForwarder.objects.get(id=value)
        except DataForwarder.DoesNotExist:
            raise ValidationError("DataForwarder with this ID does not exist")
        return value

    def validate_project_id(self, value: int) -> int:
        try:
            Project.objects.get(id=value)
        except Project.DoesNotExist:
            raise ValidationError("Project with this ID does not exist")
        return value

    def validate(self, attrs: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        data_forwarder_id = attrs.get("data_forwarder_id")
        project_id = attrs.get("project_id")

        if data_forwarder_id and project_id:
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
