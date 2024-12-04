import sentry_sdk
from sentry_sdk.flag_utils import flag_error_processor
from sentry_sdk.integrations import Integration


class FlagPoleIntegration(Integration):
    identifier = "flag_pole"

    @staticmethod
    def setup_once():
        scope = sentry_sdk.get_current_scope()
        scope.add_error_processor(flag_error_processor)


def flag_pole_hook(flag: str, result: bool):
    flags = sentry_sdk.get_current_scope().flags
    flags.set(flag, result)
