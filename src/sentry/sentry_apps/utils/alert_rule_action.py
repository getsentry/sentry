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
                message=result.message,
            )
        case SentryAppErrorType.CLIENT:
            raise serializers.ValidationError(result.message, result.public_context)
        case SentryAppErrorType.SENTRY:
            logger.error(
                "create-failed",
                extras={
                    "message": result.message,
                    **result.webhook_context,
                    **result.public_context,
                },
            )
            raise Exception(
                message=result.message,
            )
