import logging
from enum import Enum
from typing import Literal, TypedDict

from django.contrib.sessions.backends.base import SessionBase
from django.db import router, transaction

from sentry.api.helpers.oauth_consent import (
    OAuthDecision,
    persist_authorization,
    resolve_organization,
)
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apidevicecode import (
    USER_CODE_GROUP_LENGTH,
    USER_CODE_LENGTH,
    ApiDeviceCode,
    DeviceCodeStatus,
)
from sentry.ratelimits import backend as ratelimiter
from sentry.utils import metrics

USER_CODE_RATE_LIMIT_WINDOW = 60
USER_CODE_RATE_LIMIT = 10
logger = logging.getLogger("sentry.oauth")


class DeviceRequestErrorCode(Enum):
    INVALID_CODE = "invalid_code"
    EXPIRED = "expired"
    RATE_LIMITED = "rate_limited"
    INVALID_SESSION = "invalid_session"


DEVICE_REQUEST_ERROR_STATUS = {
    DeviceRequestErrorCode.INVALID_CODE: 400,
    DeviceRequestErrorCode.EXPIRED: 400,
    DeviceRequestErrorCode.RATE_LIMITED: 429,
    DeviceRequestErrorCode.INVALID_SESSION: 400,
}


class InvalidDeviceRequest(Exception):
    def __init__(self, code: DeviceRequestErrorCode) -> None:
        self.code = code
        self.public_message = {
            DeviceRequestErrorCode.INVALID_CODE: "Invalid or expired code. Please check the code and try again.",
            DeviceRequestErrorCode.EXPIRED: "This code has expired. Please request a new code from your device.",
            DeviceRequestErrorCode.RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
            DeviceRequestErrorCode.INVALID_SESSION: "Your session has expired. Please start over.",
        }[code]
        super().__init__(self.public_message)


def normalize_user_code(user_code: str) -> str:
    normalized = user_code.replace("-", "").upper().strip()
    if len(normalized) == USER_CODE_LENGTH:
        return f"{normalized[:USER_CODE_GROUP_LENGTH]}-{normalized[USER_CODE_GROUP_LENGTH:]}"

    return user_code.upper().strip()


def validate_device_request(device: ApiDeviceCode) -> None:
    if device.status != DeviceCodeStatus.PENDING:
        raise InvalidDeviceRequest(DeviceRequestErrorCode.INVALID_CODE)

    if device.is_expired():
        raise InvalidDeviceRequest(DeviceRequestErrorCode.EXPIRED)

    if device.application.status != ApiApplicationStatus.active:
        raise InvalidDeviceRequest(DeviceRequestErrorCode.INVALID_CODE)


def get_device_request(user_code: str, client_ip: str | None) -> ApiDeviceCode:
    # Public context and authenticated verification share the brute-force budget.
    if ratelimiter.is_limited(
        f"oauth:device_verify:{client_ip}",
        limit=USER_CODE_RATE_LIMIT,
        window=USER_CODE_RATE_LIMIT_WINDOW,
    ):
        logger.warning("oauth.device-verification-rate-limited", extra={"ip": client_ip})
        raise InvalidDeviceRequest(DeviceRequestErrorCode.RATE_LIMITED)

    try:
        device = ApiDeviceCode.objects.select_related("application").get(
            user_code=normalize_user_code(user_code)
        )
    except ApiDeviceCode.DoesNotExist:
        raise InvalidDeviceRequest(DeviceRequestErrorCode.INVALID_CODE)

    validate_device_request(device)
    return device


def complete_device_request(
    device_id: int,
    user_id: int,
    decision: OAuthDecision,
    selected_organization_id: str | None = None,
) -> Literal["approved", "denied"]:
    # Hold the pending request until both its decision and authorization commit.
    with transaction.atomic(router.db_for_write(ApiDeviceCode)):
        try:
            device = (
                ApiDeviceCode.objects.select_related("application")
                .select_for_update()
                .get(id=device_id)
            )
        except ApiDeviceCode.DoesNotExist:
            raise InvalidDeviceRequest(DeviceRequestErrorCode.INVALID_CODE)

        validate_device_request(device)
        organization_id = None
        if decision == "approve":
            organization_id = resolve_organization(
                device.application, user_id, selected_organization_id
            )
            persist_authorization(device.application, user_id, device.get_scopes(), organization_id)

        status: Literal["approved", "denied"] = "approved" if decision == "approve" else "denied"
        device.update(
            status=status,
            user_id=user_id if decision == "approve" else None,
            organization_id=organization_id,
        )

    if decision == "approve":
        metrics.incr(
            "oauth_device.approve",
            sample_rate=1.0,
            tags={"org_level_access": device.application.requires_org_level_access},
        )
        logger.info(
            "oauth.device-code-approved",
            extra={
                "device_code_id": device.id,
                "application_id": device.application_id,
                "user_id": user_id,
                "organization_id": organization_id,
            },
        )
    else:
        metrics.incr("oauth_device.deny", sample_rate=1.0)
        logger.info(
            "oauth.device-code-denied",
            extra={
                "device_code_id": device.id,
                "application_id": device.application_id,
                "user_id": user_id,
            },
        )

    return status


class DeviceConsentSession(TypedDict):
    device_code_id: int
    user_id: int


def prepare_device_consent(session: SessionBase, device: ApiDeviceCode, user_id: int) -> None:
    payload: DeviceConsentSession = {"device_code_id": device.id, "user_id": user_id}
    session[f"oa2:{device.user_code}"] = payload


def get_prepared_device_request(
    session: SessionBase, user_code: str, user_id: int
) -> ApiDeviceCode:
    normalized = normalize_user_code(user_code)
    payload: DeviceConsentSession | None = session.get(f"oa2:{normalized}")
    if not payload or payload["user_id"] != user_id:
        raise InvalidDeviceRequest(DeviceRequestErrorCode.INVALID_SESSION)

    try:
        device = ApiDeviceCode.objects.select_related("application").get(
            id=payload["device_code_id"], user_code=normalized
        )
    except ApiDeviceCode.DoesNotExist:
        raise InvalidDeviceRequest(DeviceRequestErrorCode.INVALID_CODE)

    validate_device_request(device)
    return device
