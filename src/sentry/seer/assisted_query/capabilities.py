from typing import Any

from rest_framework import serializers

from sentry import features
from sentry.auth.principal import RequestPrincipal
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import TransformationCapabilities, TransformationDataset


def get_transformation_capabilities(
    organization: Organization, *, actor: RequestPrincipal
) -> TransformationCapabilities:
    datasets: list[TransformationDataset] = []
    if features.has("organizations:explore-interpolation-and-smoothing", organization, actor=actor):
        if features.has("organizations:visibility-explore-view", organization, actor=actor):
            datasets.append("spans")
        if features.has("organizations:ourlogs-enabled", organization, actor=actor):
            datasets.append("logs")
        if features.has("organizations:tracemetrics-enabled", organization, actor=actor):
            datasets.append("tracemetrics")
    return TransformationCapabilities(datasets=datasets)


def validate_search_agent_options(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return None
    if "transformation_capabilities" in value:
        raise serializers.ValidationError("transformation_capabilities is derived by Sentry")
    if "model_name" in value and not isinstance(value["model_name"], str):
        raise serializers.ValidationError("model_name must be a string")
    return value
