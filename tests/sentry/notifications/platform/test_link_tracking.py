import html
import re
from collections.abc import Iterator, Mapping
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlsplit

from django.core.mail import EmailMultiAlternatives

from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.registry import (
    provider_registry,
    renderer_registry,
    template_registry,
)
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.tracking import NotificationLink, classify_link
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


def get_strings(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, EmailMultiAlternatives):
        yield str(value.body)
        for content, _ in value.alternatives:
            yield html.unescape(str(content))
    elif isinstance(value, Mapping):
        for item in value.values():
            yield from get_strings(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from get_strings(item)
    elif hasattr(value, "to_dict"):
        yield from get_strings(value.to_dict())
    elif hasattr(value, "__dict__"):
        yield from get_strings(vars(value))


def get_urls(value: Any) -> list[str]:
    return [
        match.group(0)
        for text in get_strings(value)
        for match in re.finditer(r"https?://[^\s<>'\"\]\)\|]+", text)
    ]


class RenderTemplateLinkTrackingTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(
            override_options(
                {
                    "system.url-prefix": "https://sentry.io",
                    "notifications.tracking.sources": list(template_registry.registrations),
                }
            )
        )

    def test_default_renderer_payload_links_are_tracked(self) -> None:
        checked = 0
        for source, template_cls in template_registry.registrations.items():
            template = template_cls()
            data = template.example_data
            for provider in provider_registry.get_all():
                if provider.get_renderer(data=data) is not provider.default_renderer:
                    continue

                with self.subTest(source=source, provider=provider.key):
                    renderable, links = NotificationService.render_for_send(
                        data=data, template=template, provider=provider
                    )
                    urls = get_urls(renderable)

                    tracked_urls = [
                        url
                        for url in urls
                        if parse_qs(urlsplit(url).query).get("referrer")
                        == [f"{source}-{provider.key}"]
                        and parse_qs(urlsplit(url).query).get("notification_uuid")
                        == [data.notification_uuid]
                    ]
                    assert links == {classify_link(url) for url in tracked_urls}
                    checked += len(tracked_urls)

        assert checked

    def test_custom_renderer_payloads_are_decorated(self) -> None:
        renderables: dict[NotificationProviderKey, Any] = {
            NotificationProviderKey.SLACK: {
                "blocks": [],
                "text": "<https://sentry.io/issues/1/|Issue>",
            },
            NotificationProviderKey.DISCORD: {
                "content": "[Issue](https://sentry.io/issues/1/)",
                "embeds": [],
                "components": [],
            },
            NotificationProviderKey.MSTEAMS: {
                "type": "AdaptiveCard",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "[Issue](https://sentry.io/issues/1/)",
                    }
                ],
                "version": "1.5",
            },
        }

        for (provider_key, source), renderer in renderer_registry.registrations.items():
            if source not in template_registry.registrations:
                continue
            template = template_registry.get(source)()
            data = template.example_data
            renderable = renderables[provider_key]
            with (
                self.subTest(source=source, provider=provider_key),
                mock.patch.object(renderer, "render", return_value=renderable) as render,
            ):
                decorated, links = NotificationService.render_for_send(
                    data=data, template=template, provider=provider_registry.get(provider_key)
                )

                render.assert_called_once_with(
                    data=data, rendered_template=template.render(data=data)
                )
                text = "\n".join(get_strings(decorated))
                assert f"referrer={source}-{provider_key}" in text
                assert f"notification_uuid={data.notification_uuid}" in text
                assert links == {NotificationLink.ISSUE}

    @override_options({"notifications.tracking.sources": ["test"]})
    def test_render_template_does_not_decorate_preview_payload(self) -> None:
        data = MockNotification(message="test")

        renderable = NotificationService.render_template(
            data=data,
            template=MockNotificationTemplate(),
            provider=EmailNotificationProvider,
        )

        assert "notification_uuid=" not in "\n".join(get_strings(renderable))
