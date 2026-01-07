from unittest.mock import Mock

from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.plugins.sentry_urls.models import UrlsPlugin
from sentry.testutils.cases import TestCase


class UrlsPluginTest(TestCase):
    def setUp(self):
        self.plugin = UrlsPlugin()

    def test_get_tag_values_with_short_url(self):
        """URLs under MAX_TAG_VALUE_LENGTH should be returned as-is."""
        url = "https://example.com/path/to/page"
        event = Mock()
        event.interfaces = {"request": Mock(url=url)}

        result = self.plugin.get_tag_values(event)

        assert result == [url]

    def test_get_tag_values_truncates_long_url(self):
        """URLs exceeding MAX_TAG_VALUE_LENGTH should be truncated with '...'."""
        # Create a URL that exceeds the limit
        url = "https://example.com/" + "a" * 300
        assert len(url) > MAX_TAG_VALUE_LENGTH

        event = Mock()
        event.interfaces = {"request": Mock(url=url)}

        result = self.plugin.get_tag_values(event)

        assert len(result) == 1
        assert len(result[0]) == MAX_TAG_VALUE_LENGTH
        assert result[0].endswith("...")
        # Verify the truncated content is correct (minus the "...")
        assert result[0][:-3] == url[: MAX_TAG_VALUE_LENGTH - 3]

    def test_get_tag_values_url_exactly_at_limit(self):
        """URLs exactly at MAX_TAG_VALUE_LENGTH should be returned as-is."""
        url = "https://example.com/" + "a" * (MAX_TAG_VALUE_LENGTH - len("https://example.com/"))
        assert len(url) == MAX_TAG_VALUE_LENGTH

        event = Mock()
        event.interfaces = {"request": Mock(url=url)}

        result = self.plugin.get_tag_values(event)

        assert result == [url]
        assert "..." not in result[0]

    def test_get_tag_values_no_request_interface(self):
        """Events without a request interface should return empty list."""
        event = Mock()
        event.interfaces = {}

        result = self.plugin.get_tag_values(event)

        assert result == []

    def test_get_tag_values_no_url(self):
        """Events with request interface but no URL should return empty list."""
        event = Mock()
        event.interfaces = {"request": Mock(url=None)}

        result = self.plugin.get_tag_values(event)

        assert result == []

    def test_get_tag_values_empty_url(self):
        """Events with empty URL should return empty list."""
        event = Mock()
        event.interfaces = {"request": Mock(url="")}

        result = self.plugin.get_tag_values(event)

        assert result == []

