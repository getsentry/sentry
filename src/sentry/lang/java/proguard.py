from sentry_sdk import traces
from symbolic.proguard import ProguardMapper


def open_proguard_mapper(path: str, initialize_param_mapping: bool = False) -> ProguardMapper:
    with traces.start_span(name="proguard.open", attributes={"sentry.op": "proguard.open"}):
        return ProguardMapper.open(path, initialize_param_mapping=initialize_param_mapping)
