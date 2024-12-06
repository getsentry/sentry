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
    scope = sentry_sdk.get_current_scope()
    event["contexts"]["flags"] = {"values": scope.flags.get()}
    return event


def flag_pole_hook(flag: str, result: bool):
    flags = sentry_sdk.get_current_scope().flags
    flags.set(flag, result)
