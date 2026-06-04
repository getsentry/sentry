from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.event_manager_auto_tags import (
    ALL_TAG_DERIVERS,
    BrowserTagDeriver,
    DeviceTagDeriver,
    InterfaceTypeTagDeriver,
    OsTagDeriver,
    UrlTagDeriver,
    get_enabled_derivers,
)
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase


def _make_event(
    interfaces: dict[str, Any] | None = None,
) -> MagicMock:
    event = MagicMock()
    event.interfaces = interfaces or {}
    return event


def _make_http_interface(
    url: str | None = None,
    headers: list[list[str]] | None = None,
) -> MagicMock:
    http = MagicMock()
    http.url = url
    http.headers = headers
    return http


class TestBrowserTagDeriver:
    deriver = BrowserTagDeriver()

    def test_basic_user_agent(self) -> None:
        http = _make_http_interface(
            headers=[
                [
                    "User-Agent",
                    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                ]
            ]
        )
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert tags == [("browser", "Googlebot 2.1")]

    def test_chrome_browser(self) -> None:
        http = _make_http_interface(
            headers=[
                [
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
                ]
            ]
        )
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert tags == [("browser", "Chrome 85.0")]

    def test_family_only_no_version(self) -> None:
        http = _make_http_interface(headers=[["User-Agent", "SomeUnknownAgent"]])
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert len(tags) == 1
        assert tags[0][0] == "browser"

    def test_skips_when_contexts_present(self) -> None:
        http = _make_http_interface(headers=[["User-Agent", "Mozilla/5.0 Chrome/85.0"]])
        contexts = MagicMock()
        event = _make_event(interfaces={"request": http, "contexts": contexts})
        assert self.deriver.get_tags(event) == []

    def test_no_request_interface(self) -> None:
        event = _make_event(interfaces={})
        assert self.deriver.get_tags(event) == []

    def test_no_headers(self) -> None:
        http = _make_http_interface()
        http.headers = None
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == []

    def test_no_user_agent_header(self) -> None:
        http = _make_http_interface(headers=[["Content-Type", "text/html"]])
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == []


class TestOsTagDeriver:
    deriver = OsTagDeriver()

    def test_basic_user_agent(self) -> None:
        http = _make_http_interface(
            headers=[
                [
                    "User-Agent",
                    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                ]
            ]
        )
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert tags == [("os", "Other")]

    def test_windows_os(self) -> None:
        http = _make_http_interface(
            headers=[
                [
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                ]
            ]
        )
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert len(tags) == 1
        assert tags[0][0] == "os"
        assert tags[0][1].startswith("Windows")

    def test_skips_when_contexts_present(self) -> None:
        http = _make_http_interface(headers=[["User-Agent", "Mozilla/5.0 (Windows NT 10.0)"]])
        contexts = MagicMock()
        event = _make_event(interfaces={"request": http, "contexts": contexts})
        assert self.deriver.get_tags(event) == []


class TestDeviceTagDeriver:
    deriver = DeviceTagDeriver()

    def test_basic_user_agent(self) -> None:
        http = _make_http_interface(
            headers=[
                [
                    "User-Agent",
                    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                ]
            ]
        )
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert tags == [("device", "Spider")]

    def test_iphone_device(self) -> None:
        http = _make_http_interface(
            headers=[
                [
                    "User-Agent",
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
                ]
            ]
        )
        event = _make_event(interfaces={"request": http})
        tags = self.deriver.get_tags(event)
        assert tags == [("device", "iPhone")]

    def test_skips_when_contexts_present(self) -> None:
        http = _make_http_interface(headers=[["User-Agent", "Mozilla/5.0 (iPhone)"]])
        contexts = MagicMock()
        event = _make_event(interfaces={"request": http, "contexts": contexts})
        assert self.deriver.get_tags(event) == []


class TestUrlTagDeriver:
    deriver = UrlTagDeriver()

    def test_extracts_url(self) -> None:
        http = _make_http_interface(url="https://example.com/path")
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == [("url", "https://example.com/path")]

    def test_no_request_interface(self) -> None:
        event = _make_event(interfaces={})
        assert self.deriver.get_tags(event) == []

    def test_no_url(self) -> None:
        http = _make_http_interface(url=None)
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == []

    def test_empty_url(self) -> None:
        http = _make_http_interface(url="")
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == []

    def test_url_exceeding_max_length(self) -> None:
        long_url = "https://example.com/" + "a" * MAX_TAG_VALUE_LENGTH
        http = _make_http_interface(url=long_url)
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == []

    def test_url_at_max_length(self) -> None:
        url = "a" * MAX_TAG_VALUE_LENGTH
        http = _make_http_interface(url=url)
        event = _make_event(interfaces={"request": http})
        assert self.deriver.get_tags(event) == [("url", url)]


class TestInterfaceTypeTagDeriver:
    deriver = InterfaceTypeTagDeriver()

    def test_extracts_interface_types(self) -> None:
        event = _make_event(
            interfaces={"sentry.interfaces.Stacktrace": MagicMock(), "request": MagicMock()}
        )
        tags = self.deriver.get_tags(event)
        assert ("interface_type", "Stacktrace") in tags
        assert ("interface_type", "request") in tags

    def test_no_interfaces(self) -> None:
        event = _make_event(interfaces={})
        assert self.deriver.get_tags(event) == []

    def test_rsplit_extracts_last_component(self) -> None:
        event = _make_event(interfaces={"sentry.interfaces.Exception": MagicMock()})
        tags = self.deriver.get_tags(event)
        assert tags == [("interface_type", "Exception")]


class TestMaxTagValueLength:
    def test_browser_tag_value_exceeding_max_length(self) -> None:
        long_family = "B" * (MAX_TAG_VALUE_LENGTH + 1)
        http = _make_http_interface(headers=[["User-Agent", f"{long_family}/1.0"]])
        event = _make_event(interfaces={"request": http})
        deriver = BrowserTagDeriver()
        tags = deriver.get_tags(event)
        for tag_key, tag_value in tags:
            assert len(tag_value) <= MAX_TAG_VALUE_LENGTH


class TestDictHeaders:
    def test_dict_headers_transitional_support(self) -> None:
        http = _make_http_interface()
        http.headers = {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        }
        event = _make_event(interfaces={"request": http})
        tags = BrowserTagDeriver().get_tags(event)
        assert tags == [("browser", "Googlebot 2.1")]


class TestGetEnabledDerivers(TestCase):
    def test_default_returns_default_enabled(self) -> None:
        project = self.create_project()
        derivers = get_enabled_derivers(project)
        tags = {d.tag for d in derivers}
        assert "browser" in tags
        assert "os" in tags
        assert "device" in tags
        assert "url" in tags
        assert "interface_type" in tags

    def test_disabling_default_on_deriver(self) -> None:
        project = self.create_project()
        ProjectOption.objects.set_value(project, "auto_tag:_browsers:enabled", False)
        derivers = get_enabled_derivers(project)
        tags = {d.tag for d in derivers}
        assert "browser" not in tags
        assert "os" in tags

    def test_disabling_interface_type_deriver(self) -> None:
        project = self.create_project()
        ProjectOption.objects.set_value(project, "auto_tag:_interface_types:enabled", False)
        derivers = get_enabled_derivers(project)
        tags = {d.tag for d in derivers}
        assert "interface_type" not in tags

    def test_all_disabled(self) -> None:
        project = self.create_project()
        for deriver in ALL_TAG_DERIVERS:
            ProjectOption.objects.set_value(project, deriver.option_key, False)
        derivers = get_enabled_derivers(project)
        assert derivers == []

    def test_all_enabled(self) -> None:
        project = self.create_project()
        for deriver in ALL_TAG_DERIVERS:
            ProjectOption.objects.set_value(project, deriver.option_key, True)
        derivers = get_enabled_derivers(project)
        assert len(derivers) == len(ALL_TAG_DERIVERS)


class TestAllTagDerivers:
    def test_all_derivers_have_unique_tags(self) -> None:
        tags = [d.tag for d in ALL_TAG_DERIVERS]
        assert len(tags) == len(set(tags))

    def test_all_derivers_have_unique_option_keys(self) -> None:
        keys = [d.option_key for d in ALL_TAG_DERIVERS]
        assert len(keys) == len(set(keys))

    def test_deriver_count(self) -> None:
        assert len(ALL_TAG_DERIVERS) == 5
