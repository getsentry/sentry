from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any

from ua_parser.user_agent_parser import Parse

if TYPE_CHECKING:
    from ua_parser.user_agent_parser import _ParseResult

from sentry.constants import MAX_TAG_VALUE_LENGTH


class TagDeriver(abc.ABC):
    tag: str
    option_key: str
    default_enabled: bool

    @abc.abstractmethod
    def get_tags(self, event: Any) -> list[tuple[str, str]]: ...


class _UserAgentTagDeriver(TagDeriver):
    """Base for derivers that extract tags from the User-Agent header."""

    default_enabled = True

    def get_tags(self, event: Any) -> list[tuple[str, str]]:
        if event.interfaces.get("contexts"):
            return []

        http = event.interfaces.get("request")
        if not http or not http.headers:
            return []

        headers = http.headers
        if isinstance(headers, dict):
            headers = headers.items()

        results: list[tuple[str, str]] = []
        for key, value in headers:
            if key != "User-Agent":
                continue
            tag_value = self._extract_from_ua(Parse(value))
            if tag_value and len(tag_value) <= MAX_TAG_VALUE_LENGTH:
                results.append((self.tag, tag_value))
        return results

    def _extract_from_ua(self, ua: _ParseResult) -> str | None:
        raise NotImplementedError


class BrowserTagDeriver(_UserAgentTagDeriver):
    tag = "browser"
    option_key = "auto_tag:_browsers:enabled"

    def _extract_from_ua(self, ua: _ParseResult) -> str | None:
        browser = ua["user_agent"]
        if not browser["family"]:
            return None
        version = ".".join(v for v in [browser["major"], browser["minor"]] if v)
        tag = browser["family"]
        if version:
            tag += " " + version
        return tag


class OsTagDeriver(_UserAgentTagDeriver):
    tag = "os"
    option_key = "auto_tag:_operating_systems:enabled"

    def _extract_from_ua(self, ua: _ParseResult) -> str | None:
        os_info = ua["os"]
        if not os_info["family"]:
            return None
        version = ".".join(v for v in [os_info["major"], os_info["minor"], os_info["patch"]] if v)
        tag = os_info["family"]
        if version:
            tag += " " + version
        return tag


class DeviceTagDeriver(_UserAgentTagDeriver):
    tag = "device"
    option_key = "auto_tag:_device:enabled"

    def _extract_from_ua(self, ua: _ParseResult) -> str | None:
        return ua["device"]["family"]


class UrlTagDeriver(TagDeriver):
    tag = "url"
    option_key = "auto_tag:_urls:enabled"
    default_enabled = True

    def get_tags(self, event: Any) -> list[tuple[str, str]]:
        http = event.interfaces.get("request")
        if not http or not http.url:
            return []
        if len(http.url) > MAX_TAG_VALUE_LENGTH:
            return []
        return [(self.tag, http.url)]


class InterfaceTypeTagDeriver(TagDeriver):
    tag = "interface_type"
    option_key = "auto_tag:_interface_types:enabled"
    default_enabled = True

    def get_tags(self, event: Any) -> list[tuple[str, str]]:
        return [
            (self.tag, iface.rsplit(".", 1)[-1])
            for iface in event.interfaces.keys()
            if len(iface.rsplit(".", 1)[-1]) <= MAX_TAG_VALUE_LENGTH
        ]


ALL_TAG_DERIVERS: list[TagDeriver] = [
    BrowserTagDeriver(),
    OsTagDeriver(),
    DeviceTagDeriver(),
    UrlTagDeriver(),
    InterfaceTypeTagDeriver(),
]


def get_enabled_derivers() -> list[TagDeriver]:
    return [deriver for deriver in ALL_TAG_DERIVERS if deriver.default_enabled]
