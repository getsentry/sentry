from symbolic.proguard import ProguardMapper

from sentry.utils.tracing import start_span


def open_proguard_mapper(*args, **kwargs):
    with start_span(op="proguard.open", name="proguard.open"):
        return ProguardMapper.open(*args, **kwargs)
