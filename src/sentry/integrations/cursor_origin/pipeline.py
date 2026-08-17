from __future__ import annotations

from typing import Any, TypedDict

import jwt
from django.http import HttpRequest
from django.urls import reverse
from rest_framework import serializers

from sentry.integrations.cursor_origin.integration import build_install_url
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.types import PipelineStepResult
from sentry.utils.http import absolute_uri


class InstallStepData(TypedDict):
    installUrl: str


class InstallSerializer(serializers.Serializer[dict[str, Any]]):
    installation_receipt = serializers.CharField(required=False, allow_blank=True)
    installation_id = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(required=True)


def _redirect_uri() -> str:
    return absolute_uri(
        reverse(
            "sentry-extension-setup",
            kwargs={"provider_id": IntegrationProviderSlug.CURSOR_ORIGIN.value},
        )
    )


def _installation_id_from_receipt(receipt: str) -> str | None:
    """Pull the installation id out of the signed receipt Origin returns.

    The receipt is signed by Origin, not by us, so we cannot verify it here --
    and we do not need to: the id is immediately used to call Origin with our
    own app credentials, which is what actually establishes trust. A forged
    receipt yields an installation we have no access to, and the call fails.
    """
    try:
        claims = jwt.decode(receipt, options={"verify_signature": False})
    except jwt.PyJWTError:
        return None
    subject = claims.get("sub")
    return str(subject) if subject else None


class CursorOriginInstallApiStep:
    """Single-step install.

    Origin's redirect returns an installation receipt directly, so unlike GitHub
    there is no OAuth login leg and no separate organization-selection step.
    """

    step_name = "install"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> InstallStepData:
        return {
            "installUrl": build_install_url(state=pipeline.signature, redirect_uri=_redirect_uri())
        }

    def get_serializer_cls(self) -> type:
        return InstallSerializer

    def handle_post(
        self,
        validated_data: dict[str, Any],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        if validated_data["state"] != pipeline.signature:
            return PipelineStepResult.error("Invalid state, please try the installation again.")

        installation_id = validated_data.get("installation_id")
        if not installation_id:
            receipt = validated_data.get("installation_receipt")
            if receipt:
                installation_id = _installation_id_from_receipt(receipt)

        if not installation_id:
            return PipelineStepResult.error(
                "Cursor Origin did not return an installation. Please try again."
            )

        pipeline.bind_state("installation_id", installation_id)
        return PipelineStepResult.advance()
