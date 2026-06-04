from typing import Any

import sentry_sdk


def record_feature_flag(name: str, result: Any) -> None:
    if isinstance(result, bool):
        sentry_sdk.feature_flags.add_feature_flag("feature." + name, result)


def record_option(name: str, result: Any) -> None:
    if isinstance(result, bool):
        sentry_sdk.feature_flags.add_feature_flag("option." + name, result)
