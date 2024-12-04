import logging

import sentry_sdk
from sentry_sdk.integrations import Integration

logger = logging.getLogger()


class FlagPoleIntegration(Integration):
    identifier = "flag_pole"

    @staticmethod
    def setup_once():
        scope = sentry_sdk.get_current_scope()
        scope.add_error_processor(flag_error_processor)


def flag_error_processor(event, exc_info):
    try:
        scope = sentry_sdk.get_current_scope()
        event["contexts"]["flags"] = {"values": scope.flags.get()}
        return event
    except Exception:
        logger.exception("Flag serialization failed")


def flag_pole_hook(flag: str, result: bool):
    try:
        flags = sentry_sdk.get_current_scope().flags
        flags.set(flag, result)
    except Exception:
        logger.exception("Set flag failed")
