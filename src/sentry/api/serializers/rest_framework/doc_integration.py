from jsonschema.exceptions import ValidationError as SchemaValidationError
from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.api.serializers.rest_framework.sentry_app import URLField
from sentry.api.validators.doc_integration import validate_metadata_schema


class MetadataField(serializers.JSONField):
    def to_internal_value(self, data):
        if data is None:
            return

        if data == "" or data == {}:
            return {}

        try:
            validate_metadata_schema(data)
        except SchemaValidationError as e:
            raise ValidationError(e.message)  # noqa: B306

        return data


class DocIntegrationSerializer(Serializer):
    name = serializers.CharField(max_length=255)
    slug = serializers.CharField(max_length=64)
    author = serializers.CharField(max_length=255)
    description = serializers.TextField()
    url = URLField()
    popularity = serializers.PositiveSmallIntegerField(default=1, allow_null=True)
    is_draft = serializers.BooleanField(default=True)
    metadata = MetadataField(allow_null=True)
