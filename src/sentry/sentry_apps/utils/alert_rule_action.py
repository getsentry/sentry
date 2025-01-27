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
        return None

    error_type = SentryAppErrorType(result.error_type)
    match error_type:
        case SentryAppErrorType.INTEGRATOR:
            raise SentryAppIntegratorError(
                message=result.message, public_context=result.public_context
            )
        case SentryAppErrorType.CLIENT:
            raise SentryAppError(message=result.message, public_context=result.public_context)
        case SentryAppErrorType.SENTRY:
            logger.error(
                "create-failed",
                extra={
                    "message_str": result.message,
                    "webhook_context": result.webhook_context if result.webhook_context else None,
                    "public_context": result.public_context if result.public_context else None,
                },
            )
            raise SentryAppSentryError(
                message="Something went wrong during the alert rule action process!",
            )
