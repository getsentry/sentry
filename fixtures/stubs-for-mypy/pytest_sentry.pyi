import sentry_sdk
from sentry_sdk.integrations import Integration

class PytestIntegration(Integration):
    always_report: bool
    @staticmethod
    def setup_once() -> None: ...

def _resolve_scope_marker_value(marker_value: object) -> sentry_sdk.Scope: ...
