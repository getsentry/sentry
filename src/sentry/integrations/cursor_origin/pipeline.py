from __future__ import annotations

import logging
from typing import Any, TypedDict

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from django.http import HttpRequest
from django.urls import reverse
from rest_framework import serializers

from sentry.integrations.cursor_origin.integration import build_install_url
from sentry.integrations.cursor_origin.keys import fetch_public_keys
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.types import PipelineStepResult
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.cursor_origin")


class InstallStepData(TypedDict):
    installUrl: str


class InstallSerializer(serializers.Serializer[dict[str, Any]]):
    # Deliberately no installation_id field. The callback carries one as a plain
    # query parameter and the client forwards it, but it is caller-controlled and
    # must not be trusted -- see handle_post. Unknown keys are dropped by DRF, so
    # a client still sending it is harmless.
    installation_receipt = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(required=True)


def _redirect_uri() -> str:
    return absolute_uri(
        reverse(
            "sentry-extension-setup",
            kwargs={"provider_id": IntegrationProviderSlug.CURSOR_ORIGIN.value},
        )
    )


def _installation_id_from_receipt(receipt: str) -> str | None:
    """The installation id from Origin's receipt, or None if it does not verify.

    The signature is the only thing that ties this installation to the person
    installing it. Reading `sub` without checking it -- as this used to -- lets a
    caller name any installation Sentry's app can read and have build_integration
    store it as the Integration's external_id, binding another organization's
    codebase to theirs. The pipeline `state` value does not help: it authenticates
    the Sentry session that started the flow, not ownership of the installation.

    Fails closed. If the JWKS cannot be fetched, no key verifies and the install
    is refused rather than trusted.

    Like webhook deliveries, receipts carry no key id we can rely on, so every
    active key is tried.
    """
    for force_refresh in (False, True):
        keys = fetch_public_keys(force_refresh=force_refresh)
        for key_bytes in keys:
            try:
                claims = jwt.decode(
                    receipt,
                    key=Ed25519PublicKey.from_public_bytes(key_bytes),
                    algorithms=["EdDSA"],
                    # Origin does not document an `aud` on receipts. The signature
                    # and `sub` are what this relies on.
                    options={"verify_aud": False},
                )
            except (jwt.PyJWTError, ValueError):
                continue
            subject = claims.get("sub")
            return str(subject) if subject else None
        # Only worth refetching if the cache could have been stale.
        if not keys:
            break

    logger.warning("cursor_origin.install.receipt_verification_failed")
    return None


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

        # The signed receipt is the only accepted source for the installation id.
        # The callback also carries a bare installation_id query parameter, but
        # anyone can put any value there, so it is ignored.
        receipt = validated_data.get("installation_receipt")
        installation_id = _installation_id_from_receipt(receipt) if receipt else None

        if not installation_id:
            return PipelineStepResult.error(
                "Cursor Origin did not return a valid installation. Please try again."
            )

        pipeline.bind_state("installation_id", installation_id)
        return PipelineStepResult.advance()
