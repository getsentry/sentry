from enum import Enum

from sentry.exceptions import SentryAppError, SentryAppIntegratorError
from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


def raise_alert_rule_action_result_errors(result: RpcAlertRuleActionResult) -> None:
    match result.error_type:
        case SentryAppErrorType.INTEGRATOR:
            raise SentryAppIntegratorError(result.message)
        case SentryAppErrorType.CLIENT:
            raise SentryAppError(result.message)
        case SentryAppErrorType.SENTRY:
            raise Exception(result.message)

    return None
