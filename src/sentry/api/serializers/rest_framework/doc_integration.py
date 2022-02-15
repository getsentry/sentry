from typing import Any, MutableMapping

from django.db import transaction
from django.template.defaultfilters import slugify
from jsonschema.exceptions import ValidationError as SchemaValidationError
from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.api.fields.avatar import AvatarField
from sentry.api.serializers.rest_framework.sentry_app import URLField
from sentry.api.validators.doc_integration import validate_metadata_schema
from sentry.models import DocIntegration, IntegrationFeature
from sentry.models.integrations.integration_feature import Feature, IntegrationTypes


class MetadataField(serializers.JSONField):
    def to_internal_value(self, data):
        if data is None:
            return

        if data == "" or data == {}:
            return {}

        try:
            validated_data = validate_metadata_schema(data)
        except SchemaValidationError as e:
            raise ValidationError(e.message)  # noqa: B306

        return validated_data


class DocIntegrationSerializer(Serializer):
    name = serializers.CharField(max_length=255)
    author = serializers.CharField(max_length=255)
    description = serializers.CharField()
    url = URLField()
    popularity = serializers.IntegerField(min_value=0, max_value=32767, allow_null=True)
    is_draft = serializers.BooleanField(default=True)
    metadata = MetadataField(allow_null=True, required=False)
    features = serializers.MultipleChoiceField(
        choices=Feature.as_choices(), allow_blank=True, allow_null=True, required=False
    )

    def _generate_slug(self, name: str) -> str:
        return slugify(name)

    def validate_name(self, value: str) -> str:
        slug = self._generate_slug(value)
        if len(slug) > DocIntegration._meta.get_field("slug").max_length:
            raise ValidationError(
                f"Generated slug '{slug}' is too long, please use a shorter name."
            )
        # Only check this for validating creation, not updates
        if self.instance is None:
            queryset = DocIntegration.objects.filter(slug=slug)
            if queryset.exists():
                raise ValidationError(f"Name '{value}' is already taken, please use another.")
        return value

    def create(self, validated_data: MutableMapping[str, Any]) -> DocIntegration:
        slug = self._generate_slug(validated_data["name"])
        features = validated_data.pop("features") if validated_data.get("features") else []
        with transaction.atomic():
            doc_integration = DocIntegration.objects.create(slug=slug, **validated_data)
            IntegrationFeature.objects.bulk_create(
                [
                    IntegrationFeature(
                        target_id=doc_integration.id,
                        target_type=IntegrationTypes.DOC_INTEGRATION.value,
                        feature=feature,
                    )
                    for feature in features
                ]
            )
        return doc_integration

    def update(
        self, doc_integration: DocIntegration, validated_data: MutableMapping[str, Any]
    ) -> DocIntegration:
        if validated_data.get("features"):
            features = validated_data.pop("features")

            IntegrationFeature.objects.clean_update(
                incoming_features=features,
                target=doc_integration,
                target_type=IntegrationTypes.DOC_INTEGRATION,
            )
        # If we're publishing...
        if not validated_data.get("is_draft", True):
            if not doc_integration.avatar.exists():
                raise serializers.ValidationError({"avatar": "A logo is required for publishing."})
        # Update the DocIntegration
        for key, value in validated_data.items():
            setattr(doc_integration, key, value)
        doc_integration.save()
        return doc_integration


class DocIntegrationAvatarSerializer(Serializer):
    avatar_photo = AvatarField(required=True)
    avatar_type = serializers.ChoiceField(choices=(("upload", "upload")))

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if not attrs.get("avatar_photo"):
            raise serializers.ValidationError({"avatar_photo": "A logo is required."})

        return attrs
