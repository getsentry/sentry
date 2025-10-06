import re
from collections.abc import MutableMapping
from typing import Any, TypedDict

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry_plugins.amazon_sqs.plugin import get_regions


class SQSConfig(TypedDict, total=False):
    queue_url: str
    region: str
    access_key: str
    secret_key: str
    message_group_id: str | None
    s3_bucket: str | None


class SegmentConfig(TypedDict, total=False):
    write_key: str


class SplunkConfig(TypedDict, total=False):
    instance_url: str
    index: str
    source: str
    token: str


SQS_REQUIRED_KEYS = ["queue_url", "region", "access_key", "secret_key"]
SEGMENT_REQUIRED_KEYS = ["write_key"]
SPLUNK_REQUIRED_KEYS = ["instance_url", "index", "source", "token"]


class DataForwarderSerializer(Serializer):
    organization_id = serializers.IntegerField()
    is_enabled = serializers.BooleanField(default=True)
    enroll_new_projects = serializers.BooleanField(default=False)
    provider = serializers.ChoiceField(
        choices=[
            (DataForwarderProviderSlug.SEGMENT, "Segment"),
            (DataForwarderProviderSlug.SQS, "Amazon SQS"),
            (DataForwarderProviderSlug.SPLUNK, "Splunk"),
        ]
    )
    config = serializers.DictField(
        child=serializers.CharField(allow_blank=False, allow_null=True), default=dict
    )

    def validate_config(self, config) -> SQSConfig | SegmentConfig | SplunkConfig:
        provider = self.initial_data.get("provider")

        if provider == DataForwarderProviderSlug.SQS:
            return self._validate_sqs_config(config)
        elif provider == DataForwarderProviderSlug.SEGMENT:
            return self._validate_segment_config(config)
        elif provider == DataForwarderProviderSlug.SPLUNK:
            return self._validate_splunk_config(config)

        raise ValidationError(f"Invalid provider: {provider}")

    def _validate_all_fields_present(
        self,
        config: dict,
        required_fields: list[str] | frozenset[str],
        provider: DataForwarderProviderSlug,
    ) -> None:
        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            raise ValidationError(
                f"Missing required {provider.value} fields: {', '.join(missing_fields)}"
            )

    def _validate_sqs_queue_url(self, config: dict, errors: list[str]) -> None:
        queue_url = config.get("queue_url")
        sqs_url_pattern = (
            r"^https://sqs\.[a-z0-9\-]+\.amazonaws\.com/\d+/[a-zA-Z0-9\-_/]+(?:\.fifo)?$"
        )
        if not queue_url or not re.match(sqs_url_pattern, queue_url):
            errors.append(
                "queue_url must be a valid SQS URL format: "
                "https://sqs.<region>.amazonaws.com/<account>/<queue-name>"
            )

    def _validate_sqs_region(self, config: dict, errors: list[str]) -> None:
        region = config.get("region")
        valid_regions = get_regions()
        if not region or region not in valid_regions:
            errors.append("region must be a valid AWS region")

    def _validate_sqs_message_group_id(self, config: dict, errors: list[str]) -> None:
        message_group_id = config.get("message_group_id")
        queue_url = config.get("queue_url")

        if isinstance(queue_url, str) and queue_url.endswith(".fifo") and not message_group_id:
            errors.append("message_group_id is required for FIFO queues")

    def _validate_sqs_s3_bucket(self, config: dict, errors: list[str]) -> None:
        s3_bucket = config.get("s3_bucket")
        if s3_bucket is not None:
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
        instance_url = config.get("instance_url")
        if not instance_url or not re.match(splunk_url_pattern, instance_url):
            errors.append("instance_url must be a valid URL starting with http:// or https://")

    def _validate_splunk_token_format(self, config: dict, errors: list[str]) -> None:
        token = config.get("token")
        if token:
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

    def _validate_sqs_config(self, config) -> SQSConfig:
        self._validate_all_fields_present(config, SQS_REQUIRED_KEYS, DataForwarderProviderSlug.SQS)

        errors: list[str] = []
        self._validate_sqs_queue_url(config, errors)
        self._validate_sqs_region(config, errors)
        self._validate_sqs_message_group_id(config, errors)
        self._validate_sqs_s3_bucket(config, errors)

        if errors:
            raise ValidationError(errors)

        return config

    def _validate_segment_config(self, config) -> SegmentConfig:
        self._validate_all_fields_present(
            config, SEGMENT_REQUIRED_KEYS, DataForwarderProviderSlug.SEGMENT
        )
        self._validate_segment_write_key(config)
        return config

    def _validate_splunk_config(self, config) -> SplunkConfig:
        self._validate_all_fields_present(
            config, SPLUNK_REQUIRED_KEYS, DataForwarderProviderSlug.SPLUNK
        )

        errors: list[str] = []
        self._validate_splunk_instance_url(config, errors)
        self._validate_splunk_token_format(config, errors)

        if errors:
            raise ValidationError(errors)

        return config


class DataForwarderProjectSerializer(Serializer):
    data_forwarder_id = serializers.IntegerField()
    project = ProjectField(scope="project:write", id_allowed=True)
    overrides = serializers.JSONField(default=dict)
    is_enabled = serializers.BooleanField(default=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._validated_data_forwarder: DataForwarder | None = None

    def validate_data_forwarder_id(self, value: int) -> int:
        organization = self.context.get("organization")
        if not organization:
            raise ValidationError("Organization context is required")

        try:
            data_forwarder = DataForwarder.objects.get(id=value, organization=organization)
            self._validated_data_forwarder = data_forwarder
        except DataForwarder.DoesNotExist:
            raise ValidationError("DataForwarder with this ID does not exist")
        return value

    def validate(self, attrs: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        project = attrs.get("project")

        if self._validated_data_forwarder is None:
            raise ValidationError("DataForwarder validation failed")

        if self._validated_data_forwarder.organization_id != project.organization_id:
            raise ValidationError("DataForwarder and Project must belong to the same organization.")

        existing = DataForwarderProject.objects.filter(
            data_forwarder_id=self._validated_data_forwarder.id,
            project_id=project.id,
        )

        if self.instance:
            existing = existing.exclude(id=self.instance.id)

        if existing.exists():
            raise ValidationError(
                "A DataForwarderProject already exists for this data forwarder and project combination."
            )

        return attrs
