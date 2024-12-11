from enum import Enum

from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


# Represents a user/client error that occured during a Sentry App process
class SentryAppError(Exception):
    error_type = SentryAppErrorType.CLIENT


# Represents an error caused by a 3p integrator during a Sentry App process
class SentryAppIntegratorError(Exception):
    error_type = SentryAppErrorType.INTEGRATOR


def raise_alert_rule_action_result_errors(result: RpcAlertRuleActionResult) -> None:
    match result.error_type:
        case SentryAppErrorType.INTEGRATOR:
            raise SentryAppIntegratorError(result.message)
        case SentryAppErrorType.CLIENT:
            raise SentryAppError(result.message)
        case SentryAppErrorType.SENTRY:
            raise Exception(result.message)

    return None
