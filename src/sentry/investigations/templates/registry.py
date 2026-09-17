from types import MappingProxyType

from sentry.investigations.templates.breached_metric import BREACHED_METRIC_TEMPLATE
from sentry.investigations.templates.types import InvestigationTemplateSpec

_TEMPLATES = MappingProxyType(
    {(BREACHED_METRIC_TEMPLATE.key, BREACHED_METRIC_TEMPLATE.version): (BREACHED_METRIC_TEMPLATE)}
)


def get_investigation_template(key: str, version: int) -> InvestigationTemplateSpec | None:
    return _TEMPLATES.get((key, version))
