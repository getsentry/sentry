from typing import Any

import sentry_sdk
from symbolic.proguard import ProguardMapper


def open_proguard_mapper(*args: Any, **kwargs: Any) -> ProguardMapper:
    with sentry_sdk.start_span(op="proguard.open"):
        return ProguardMapper.open(*args, **kwargs)
