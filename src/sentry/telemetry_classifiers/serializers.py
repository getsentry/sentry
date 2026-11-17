from __future__ import annotations

import re
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.auth.principal import acting_user_id, has_user
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.types import SnubaParams
from sentry.telemetry_classifiers.datasets import compile_filter
from sentry.telemetry_classifiers.definitions import (
    InvalidClassifierDefinition,
    resolve_prebuilt_definition,
)
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.prebuilt import PREBUILT_CLASSIFIERS
from sentry.telemetry_classifiers.types import (
    Dataset,
    PrebuiltClassifier,
    TelemetryClassifierStatus,
)
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

RESULT_ATTRIBUTE_PATTERN = re.compile(r"\A[a-z0-9_]+(\.[a-z0-9_]+)*\Z")


class TelemetryClassifierResponse(TypedDict):
    id: str
    projectId: str
    name: str
    resultAttribute: str
    dataset: str
    filterQuery: str
    status: str
    prebuiltClassifierKey: str | None
    naturalLanguagePrompt: str | None
    outputType: str | None
    createdBy: UserSerializerResponse | None
    dateAdded: datetime
    dateUpdated: datetime


@register(TelemetryClassifier)
class TelemetryClassifierSerializer(Serializer[TelemetryClassifierResponse]):
    def get_attrs(
        self,
        item_list: Sequence[TelemetryClassifier],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[TelemetryClassifier, dict[str, Any]]:
        creator_ids = {c.created_by_id for c in item_list if c.created_by_id is not None}
        serialized_users = (
            {
                u["id"]: u
                for u in user_service.serialize_many(
                    filter={"user_ids": list(creator_ids)},
                    as_user=user if has_user(user) else None,
                )
            }
            if creator_ids
            else {}
        )
        return {
            classifier: {"createdBy": serialized_users.get(str(classifier.created_by_id))}
            for classifier in item_list
        }

    def serialize(
        self,
        obj: TelemetryClassifier,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> TelemetryClassifierResponse:
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "name": obj.name,
            "resultAttribute": obj.result_attribute,
            "dataset": obj.dataset,
            "filterQuery": obj.filter_query,
            "status": obj.status,
            "prebuiltClassifierKey": obj.prebuilt_classifier_key,
            "naturalLanguagePrompt": obj.natural_language_prompt,
            "outputType": obj.output_type,
            "createdBy": attrs["createdBy"],
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }


class PrebuiltClassifierResponse(TypedDict):
    key: str
    dataset: str
    name: str
    description: str
    resultAttribute: str


class PrebuiltClassifierSerializer(Serializer[PrebuiltClassifierResponse]):
    def serialize(
        self,
        obj: PrebuiltClassifier,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> PrebuiltClassifierResponse:
        return {
            "key": obj.key,
            "dataset": obj.dataset,
            "name": obj.name,
            "description": obj.description,
            "resultAttribute": obj.result_attribute,
        }


class TelemetryClassifierRequestSerializer(CamelSnakeSerializer[TelemetryClassifier]):
    project = ProjectField(
        # Any member who can read the project may create a classifier on it for now.
        scope="project:read",
        id_allowed=True,
        help_text="The ID or slug of the project the classifier runs on.",
    )
    name = serializers.CharField(max_length=256)
    result_attribute = serializers.RegexField(
        RESULT_ATTRIBUTE_PATTERN,
        max_length=256,
        help_text=(
            "The attribute the classifier writes its result to, without the enrichment prefix. "
            "Must be unique per project."
        ),
        error_messages={
            "invalid": "Use lowercase letters, numbers, and underscores, separated by dots."
        },
    )
    dataset = serializers.ChoiceField(choices=Dataset.choices)
    filter_query = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Search query selecting the telemetry to classify.",
    )
    status = serializers.ChoiceField(
        choices=TelemetryClassifierStatus.choices,
        default=TelemetryClassifierStatus.ENABLED,
    )
    prebuilt_classifier_key = serializers.ChoiceField(
        choices=list(PREBUILT_CLASSIFIERS),
        help_text="Key of the prebuilt classifier to run.",
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # TODO: Support custom classifiers once their prompts can be compiled.
        if {"natural_language_prompt", "output_type"} & self.initial_data.keys():
            raise serializers.ValidationError("Custom classifiers aren't supported yet.")

        try:
            resolve_prebuilt_definition(attrs["prebuilt_classifier_key"], attrs["dataset"])
        except InvalidClassifierDefinition as error:
            raise serializers.ValidationError({"prebuilt_classifier_key": str(error)})

        snuba_params = SnubaParams(
            projects=[attrs["project"]], organization=self.context["organization"]
        )
        try:
            compile_filter(attrs["dataset"], attrs["filter_query"], snuba_params)
        except InvalidSearchQuery as error:
            raise serializers.ValidationError({"filter_query": str(error)})

        if TelemetryClassifier.objects.filter(
            project=attrs["project"], result_attribute=attrs["result_attribute"]
        ).exists():
            raise serializers.ValidationError(
                {"result_attribute": "Another classifier in this project uses this attribute."}
            )

        return attrs

    def create(self, validated_data: dict[str, Any]) -> TelemetryClassifier:
        return TelemetryClassifier.objects.create(
            **validated_data,
            created_by_id=acting_user_id(self.context["request"].user),
        )


class TelemetryClassifierUpdateRequestSerializer(CamelSnakeSerializer[TelemetryClassifier]):
    status = serializers.ChoiceField(choices=TelemetryClassifierStatus.choices)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # TODO: Allow editing the classifier definition, not just enabling or disabling it.
        if self.initial_data.keys() - {"status"}:
            raise serializers.ValidationError("Only status can be updated.")

        return attrs

    def update(
        self, instance: TelemetryClassifier, validated_data: dict[str, Any]
    ) -> TelemetryClassifier:
        instance.status = validated_data["status"]
        instance.save()
        return instance
