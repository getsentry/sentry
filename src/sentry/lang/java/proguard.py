from sentry_sdk import start_span
from symbolic.proguard import ProguardMapper


def open_proguard_mapper(*args, **kwargs):
    with start_span(op="proguard.open"):
        return ProguardMapper.open(*args, **kwargs)
