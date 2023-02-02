from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationJoinRequestTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=self.user)

    def test_view(self):
        self.browser.get(f"/join-request/{self.org.slug}/")
        self.browser.wait_until('[data-test-id="join-request"]')
        self.browser.snapshot(name="organization join request")
        assert self.browser.element_exists('[data-test-id="join-request"]')
