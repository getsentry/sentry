from typing import int
from sentry.models.organization import Organization
from sentry.relay.types import GenericFilter
from sentry.utils.services import Service


class Partnership(Service):
    """
    Partnership handles the partnership between the Sentry org and a partner.
    Based on the partnership agreement some behavior on Sentry might be different
    from the default behavior without the partnership.
    """

    __all__ = ("get_inbound_filters",)

    def __init__(self, **options):
        pass

    def get_inbound_filters(self, organization: Organization) -> list[GenericFilter]:
        return []
