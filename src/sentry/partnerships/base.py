from collections.abc import Sequence

from sentry.relay.types import RuleCondition
from sentry.utils.services import Service


class Partnership(Service):
    """
    Partnership handles the partnership between the Sentry org and a partner.
    Based on the partnership agreementsome behavior is enabled or disabled.
    """

    __all__ = "get_inbound_filters"

    def __init__(self, **options):
        pass

    def get_inbound_filters(self, org) -> Sequence[tuple[str, RuleCondition]]:
        return []
