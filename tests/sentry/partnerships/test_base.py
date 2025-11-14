from typing import int
from sentry.partnerships.base import Partnership
from sentry.testutils.cases import TestCase


class PartnershipTest(TestCase):
    def setUp(self) -> None:
        self.backend = Partnership()

    def test_get_inbound_filters(self) -> None:
        org = self.create_organization()
        assert self.backend.get_inbound_filters(organization=org) == []
