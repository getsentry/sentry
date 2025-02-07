from typing import Any

import sentry_sdk


def add_feature_flag(name: str, result: Any) -> None:
    if isinstance(result, bool):
        sentry_sdk.feature_flags.add_feature_flag(name, result)
