import logging

from rest_framework import serializers

from sentry.coreapi import APIError
from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import SentryAppErrorType

logger = logging.getLogger("sentry.sentry_apps.alert_rule_action")


def raise_alert_rule_action_result_errors(result: RpcAlertRuleActionResult) -> None:
    if result.error_type is None:
        return None

    error_type = SentryAppErrorType(result.error_type)
    match error_type:
        case SentryAppErrorType.INTEGRATOR:
            raise APIError(
                result.message,
            )
        case SentryAppErrorType.CLIENT:
            raise serializers.ValidationError(result.message)
        case SentryAppErrorType.SENTRY:
            logger.info(
                "create-failed",
                extra={
                    "message_str": result.message,
                    "webhook_context": result.webhook_context if result.webhook_context else None,
                    "public_context": result.public_context if result.public_context else None,
                },
            )
            raise Exception(
                result.message,
            )
