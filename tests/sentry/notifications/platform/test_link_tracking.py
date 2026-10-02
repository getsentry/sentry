import html
from collections.abc import Iterator, Mapping
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlsplit

from django.core.mail import EmailMultiAlternatives

from sentry.notifications.platform.registry import (
    provider_registry,
    renderer_registry,
    template_registry,
)
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationLink,
    NotificationRenderedTemplate,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


def get_links(
    rendered_template: NotificationRenderedTemplate,
) -> list[tuple[str, NotificationLink | None]]:
    blocks = [*rendered_template.subject_blocks, *rendered_template.footer_blocks]
    for section in rendered_template.body:
        blocks.extend(section.blocks)
    return [
        (block.url, block.tracked_as) for block in blocks if isinstance(block, LinkTextBlock)
    ] + [(action.link, action.tracked_as) for action in rendered_template.actions]


def is_sentry_page(url: str) -> bool:
    hostname = urlsplit(url).hostname or ""
    return (hostname == "sentry.io" or hostname.endswith(".sentry.io")) and hostname not in (
        "docs.sentry.io",
        "www.sentry.io",
    )


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

    def test_default_renderers_track_every_sentry_link(self) -> None:
        checked = 0
        for source, template_cls in template_registry.registrations.items():
            template = template_cls()
            data = template.example_data
            for provider in provider_registry.get_all():
                if provider.get_renderer(data=data) is not provider.default_renderer:
                    continue

                with (
                    self.subTest(source=source, provider=provider.key),
                    mock.patch.object(
                        provider.default_renderer, "render", wraps=provider.default_renderer.render
                    ) as render,
                ):
                    renderable, links = NotificationService.render_template(
                        data=data, template=template, provider=provider
                    )
                    rendered_template = render.call_args.kwargs["rendered_template"]
                    text = "\n".join(get_strings(renderable))

                    tracked: set[NotificationLink] = set()
                    for link, tracked_as in get_links(rendered_template):
                        if tracked_as is None:
                            assert not is_sentry_page(link), link
                            continue
                        query = parse_qs(urlsplit(link).query)
                        assert query["referrer"] == [f"{source}-{provider.key}"], link
                        assert query["notification_uuid"] == [data.notification_uuid], link
                        assert query["notification_link"] == [tracked_as], link
                        assert link in text, link
                        tracked.add(tracked_as)
                        checked += 1
                    assert links == tracked

        assert checked

    def test_custom_renderers_get_the_undecorated_template(self) -> None:
        for (provider_key, source), renderer in renderer_registry.registrations.items():
            if source not in template_registry.registrations:
                continue
            template = template_registry.get(source)()
            data = template.example_data
            with (
                self.subTest(source=source, provider=provider_key),
                mock.patch.object(renderer, "render") as render,
            ):
                NotificationService.render_template(
                    data=data, template=template, provider=provider_registry.get(provider_key)
                )

                render.assert_called_once_with(
                    data=data, rendered_template=template.render(data=data)
                )
