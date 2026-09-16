from __future__ import annotations

import logging
import secrets
from typing import Any, TypedDict

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from django.http import HttpRequest
from django.urls import reverse
from rest_framework import serializers

from sentry import options
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_CLOCK_SKEW_SECONDS,
    CURSOR_ORIGIN_ISSUER,
    CURSOR_ORIGIN_RECEIPT_TYP,
)
from sentry.integrations.cursor_origin.integration import build_install_url
from sentry.integrations.cursor_origin.keys import signing_keys_for
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.types import PipelineStepResult
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.cursor_origin")


class InstallStepData(TypedDict):
    installUrl: str


class InstallSerializer(serializers.Serializer[dict[str, Any]]):
    installation_receipt = serializers.CharField(required=True)
    state = serializers.CharField(required=True)


def _install_state(pipeline: IntegrationPipeline) -> str:
    """The anti-forgery value for this install, generated once per pipeline.

    `pipeline.signature` hashes the pipeline's shape, so it is the same value for
    every user and cannot tie a receipt to the session that asked for it.
    """
    state = pipeline.fetch_state("install_state")
    if not state:
        state = secrets.token_urlsafe(32)
        pipeline.bind_state("install_state", state)
    return state


def _redirect_uri() -> str:
    return absolute_uri(
        reverse(
            "sentry-extension-setup",
            kwargs={"provider_id": IntegrationProviderSlug.CURSOR_ORIGIN.value},
        )
    )


def verify_receipt(receipt: str, expected_state: str) -> str | None:
    try:
        header = jwt.get_unverified_header(receipt)
    except jwt.PyJWTError:
        logger.warning("cursor_origin.install.receipt_unreadable")
        return None

    # Header of the *unverified* token, for telemetry and key selection only.
    signing = {"alg": header.get("alg"), "kid": header.get("kid")}
    if header.get("typ") != CURSOR_ORIGIN_RECEIPT_TYP:
        logger.warning("cursor_origin.install.receipt_wrong_typ", extra=signing)
        return None

    app_id = options.get("cursor-origin-app.id")
    kid = header.get("kid")

    for key in signing_keys_for(kid):
        try:
            claims = jwt.decode(
                receipt,
                key=Ed25519PublicKey.from_public_bytes(key.public_key),
                algorithms=["EdDSA"],
                audience=app_id,
                issuer=CURSOR_ORIGIN_ISSUER,
                leeway=CURSOR_ORIGIN_CLOCK_SKEW_SECONDS,
            )
        except (jwt.PyJWTError, ValueError):
            continue

        if claims.get("state") != expected_state:
            logger.warning("cursor_origin.install.receipt_state_mismatch", extra=signing)
            return None

        subject = claims["sub"]
        if not subject:
            logger.warning("cursor_origin.install.receipt_no_subject", extra=signing)
            return None

        logger.info(
            "cursor_origin.install.receipt_verified",
            extra={**signing, "installation_id": subject},
        )
        return str(subject)

    logger.warning("cursor_origin.install.receipt_verification_failed", extra=signing)
    return None


class CursorOriginInstallApiStep:
    step_name = "install"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> InstallStepData:
        install_state = _install_state(pipeline)
        return {"installUrl": build_install_url(state=install_state, redirect_uri=_redirect_uri())}

    def get_serializer_cls(self) -> type:
        return InstallSerializer

    def handle_post(
        self,
        validated_data: dict[str, Any],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        install_state = pipeline.fetch_state("install_state")
        if not install_state or validated_data["state"] != install_state:
            return PipelineStepResult.error("Invalid state, please try the installation again.")

        installation_id = verify_receipt(validated_data["installation_receipt"], install_state)
        if not installation_id:
            return PipelineStepResult.error(
                "Cursor Origin did not return a valid installation. Please try again."
            )

        pipeline.bind_state("installation_id", installation_id)
        return PipelineStepResult.advance()
