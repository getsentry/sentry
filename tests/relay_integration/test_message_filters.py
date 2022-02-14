from sentry.ingest.inbound_filters import (
    _browser_extensions_filter,
    _legacy_browsers_filter,
    _localhost_filter,
    _web_crawlers_filter,
)
from sentry.models import ProjectOption
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.utils.safe import set_path


class FilterTests(RelayStoreHelper, TransactionTestCase):
    def _get_message(self):
        return {}

    def _set_filter_state(self, flt, state):
        ProjectOption.objects.set_value(project=self.project, key=f"filters:{flt.id}", value=state)

    def test_should_not_filter_simple_messages(self):
        # baseline test (so we know everything works as expected)
        message = self._get_message()
        self.post_and_retrieve_event(message)

    def _get_message_with_bad_ip(self):
        message = self._get_message()
        set_path(message, "user", "ip_address", value="127.0.0.1")
        return message

    def test_should_filter_local_ip_addresses_when_enabled(self):
        self._set_filter_state(_localhost_filter, "1")
        message = self._get_message_with_bad_ip()
        event = self.post_and_try_retrieve_event(message)
        assert event is None

    def test_should_not_filter_bad_ip_addresses_when_disabled(self):
        self._set_filter_state(_localhost_filter, "0")
        message = self._get_message_with_bad_ip()
        self.post_and_retrieve_event(message)

    def _get_message_with_bad_extension(self):
        message = self._get_message()
        set_path(message, "platform", value="javascript")
        set_path(
            message,
            "exception",
            value={"values": [{"type": "Error", "value": "http://loading.retry.widdit.com/"}]},
        )
        return message

    def test_should_filter_browser_extensions_when_enabled(self):
        self._set_filter_state(_browser_extensions_filter, "1")
        message = self._get_message_with_bad_extension()
        event = self.post_and_try_retrieve_event(message)
        assert event is None

    def test_should_not_filter_browser_extensions_when_disabled(self):
        self._set_filter_state(_browser_extensions_filter, "0")
        message = self._get_message_with_bad_extension()
        self.post_and_retrieve_event(message)

    def _get_message_from_webcrawler(self):
        message = self._get_message()
        set_path(
            message,
            "request",
            value={
                "url": "http://example.com",
                "method": "GET",
                "headers": [["User-Agent", "Mediapartners-Google"]],
            },
        )
        return message

    def test_should_filter_web_crawlers_when_enabled(self):
        self._set_filter_state(_web_crawlers_filter, "1")
        message = self._get_message_from_webcrawler()
        event = self.post_and_try_retrieve_event(message)
        assert event is None

    def test_should_not_filter_web_crawlers_when_disabled(self):
        self._set_filter_state(_web_crawlers_filter, "0")
        message = self._get_message_from_webcrawler()
        self.post_and_retrieve_event(message)

    def _get_message_from_legacy_browser(self):
        ie_5_user_agent = (
            "Mozilla/4.0 (compatible; MSIE 5.50; Windows NT; SiteKiosk 4.9; SiteCoach 1.0)"
        )
        message = self._get_message()
        set_path(message, "platform", value="javascript")
        set_path(
            message,
            "request",
            value={
                "url": "http://example.com",
                "method": "GET",
                "headers": [["User-Agent", ie_5_user_agent]],
            },
        )
        return message

    def test_should_filter_legacy_browsers(self):
        self._set_filter_state(_legacy_browsers_filter, "1")
        message = self._get_message_from_legacy_browser()
        event = self.post_and_try_retrieve_event(message)
        assert event is None

    def test_should_not_filter_legacy_browsers_when_disabled(self):
        self._set_filter_state(_legacy_browsers_filter, "0")
        message = self._get_message_from_legacy_browser()
        self.post_and_retrieve_event(message)
