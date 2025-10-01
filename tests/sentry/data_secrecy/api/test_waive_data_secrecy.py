from sentry.data_secrecy.types import CACHE_KEY_PATTERN
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class WaiveDataSecrecyTest(APITestCase):
    endpoint = "sentry-api-0-data-secrecy"

    def setUp(self) -> None:
        self.organization_id = 123
        self.cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization_id)

    @freeze_time("2025-01-01 12:00:00")
    def test_get_simple(self):
        pass

    def test_get_simple__no_cached_entry(self):
        pass

    def test_get_with_tickets(self):
        pass

    def test_get_no_waiver(self):
        pass

    def test_put_create(self):
        pass

    def test_put_update(self):
        pass

    def test_put_invalid_grant_end(self):
        pass

    def test_delete(self):
        pass
