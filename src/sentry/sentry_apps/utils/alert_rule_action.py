import logging

from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import (
    SentryAppError,
    SentryAppErrorType,
    SentryAppIntegratorError,
    SentryAppSentryError,
)

logger = logging.getLogger("sentry.sentry_apps.alert_rule_action")


def raise_alert_rule_action_result_errors(result: RpcAlertRuleActionResult) -> None:
    if result.error_type is None:
        raise SentryAppSentryError(
            message="Missing error type from alert rule action creator response",
            webhook_context={**result.dict()},
        )

    error_type = SentryAppErrorType(result.error_type)
    match error_type:
        case SentryAppErrorType.INTEGRATOR:
            raise SentryAppIntegratorError(
                message=result.message,
                public_context=result.public_context,
                webhook_context=result.webhook_context,
                status_code=result.status_code,
            )
        case SentryAppErrorType.CLIENT:
            raise SentryAppError(
                message=result.message,
                public_context=result.public_context,
                status_code=result.status_code,
            )
        case SentryAppErrorType.SENTRY:
            raise SentryAppSentryError(
                message="Something went wrong during the alert rule action process!",
                status_code=result.status_code,
                webhook_context=result.webhook_context,
                public_context=result.public_context,
            )
