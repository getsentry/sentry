from sentry_ophio.proguard import ProguardMapper
from sentry_sdk import traces


def open_proguard_mapper(path: str) -> ProguardMapper:
    with traces.start_span(name="proguard.open", attributes={"sentry.op": "proguard.open"}):
        return ProguardMapper.open(path)
