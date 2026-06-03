import sentry_sdk
from symbolic.proguard import ProguardMapper


def open_proguard_mapper(*args, **kwargs):
    with sentry_sdk.traces.start_span(
        name="proguard.open", attributes={"sentry.op": "proguard.open"}
    ):
        return ProguardMapper.open(*args, **kwargs)
