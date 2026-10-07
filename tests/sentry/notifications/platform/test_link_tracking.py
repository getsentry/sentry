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
from sentry.notifications.platform.templates.issue import (
    IssueNotificationData,
    IssueNotificationTemplate,
    SerializableRuleProxy,
)
from sentry.notifications.platform.tracking import NotificationLink, classify_link
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


def get_links(
    rendered_template: NotificationRenderedTemplate,
) -> list[str]:
    blocks = [*rendered_template.subject_blocks, *rendered_template.footer_blocks]
    for section in rendered_template.body:
        blocks.extend(section.blocks)
    return [block.url for block in blocks if isinstance(block, LinkTextBlock)] + [
        action.link for action in rendered_template.actions
    ]


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
                    for link in get_links(rendered_template):
                        if not is_sentry_page(link):
                            continue
                        query = parse_qs(urlsplit(link).query)
                        assert query["referrer"] == [f"{source}-{provider.key}"], link
                        assert query["notification_uuid"] == [data.notification_uuid], link
                        assert "notification_link" not in query, link
                        assert link in text, link
                        tracked.add(classify_link(link))
                        checked += 1
                    assert links == tracked

        assert checked

    def test_custom_renderers_can_decorate_links(self) -> None:
        for (provider_key, source), renderer in renderer_registry.registrations.items():
            if source not in template_registry.registrations:
                continue
            template = template_registry.get(source)()
            data = template.example_data

            def render(**kwargs: Any) -> str:
                link_decorator = kwargs["link_decorator"]
                return link_decorator.decorate("https://sentry.io/issues/1/")

            with (
                self.subTest(source=source, provider=provider_key),
                mock.patch.object(renderer, "render", side_effect=render) as mock_render,
            ):
                renderable, links = NotificationService.render_template(
                    data=data, template=template, provider=provider_registry.get(provider_key)
                )

                mock_render.assert_called_once()
                query = parse_qs(urlsplit(renderable).query)
                assert query["referrer"] == [f"{source}-{provider_key}"]
                assert query["notification_uuid"] == [data.notification_uuid]
                assert "notification_link" not in query
                assert links == {NotificationLink.ISSUE}

    @override_options({"notifications.tracking.sources": []})
    def test_custom_renderers_decorator_noops_when_tracking_is_disabled(self) -> None:
        template = template_registry.get(NotificationSource.METRIC_ALERT)()
        data = template.example_data
        renderer = renderer_registry.get(
            provider_key=NotificationProviderKey.SLACK,
            source=NotificationSource.METRIC_ALERT,
        )
        assert renderer is not None

        def render(**kwargs: Any) -> str:
            return kwargs["link_decorator"].decorate("https://sentry.io/issues/1/")

        with mock.patch.object(renderer, "render", side_effect=render):
            renderable, links = NotificationService.render_template(
                data=data,
                template=template,
                provider=provider_registry.get(NotificationProviderKey.SLACK),
            )

        assert renderable == "https://sentry.io/issues/1/"
        assert links == set()

    def test_metric_alert_custom_renderers_decorate_alert_link(self) -> None:
        template = template_registry.get(NotificationSource.METRIC_ALERT)()
        data = template.example_data

        for provider_key in (
            NotificationProviderKey.SLACK,
            NotificationProviderKey.MSTEAMS,
            NotificationProviderKey.DISCORD,
        ):
            with self.subTest(provider=provider_key):
                renderable, links = NotificationService.render_template(
                    data=data,
                    template=template,
                    provider=provider_registry.get(provider_key),
                )
                text = "\n".join(get_strings(renderable)).replace("&amp;", "&").replace("\\_", "_")

                assert f"referrer={NotificationSource.METRIC_ALERT}-{provider_key}" in text
                assert f"notification_uuid={data.notification_uuid}" in text
                assert "notification_link=" not in text
                assert links == {NotificationLink.ALERT}

    def test_issue_custom_renderers_decorate_issue_link(self) -> None:
        event = self.store_event(data={"message": "test"}, project_id=self.project.id)
        group = event.group
        assert group is not None
        data = IssueNotificationData(
            organization_id=self.organization.id,
            group_id=group.id,
            event_id=event.event_id,
            notification_uuid="test-uuid",
            rule=SerializableRuleProxy(
                id=1,
                label="Test workflow",
                data={"actions": [{"workflow_id": 1}]},
                project_id=self.project.id,
            ),
        )

        for provider_key in (
            NotificationProviderKey.SLACK,
            NotificationProviderKey.MSTEAMS,
            NotificationProviderKey.DISCORD,
        ):
            with self.subTest(provider=provider_key):
                renderable, links = NotificationService.render_template(
                    data=data,
                    template=IssueNotificationTemplate(),
                    provider=provider_registry.get(provider_key),
                )
                text = "\n".join(get_strings(renderable)).replace("&amp;", "&").replace("\\_", "_")

                assert f"referrer={NotificationSource.ISSUE}-{provider_key}" in text
                assert f"notification_uuid={data.notification_uuid}" in text
                assert "notification_link=" not in text
                assert links == {NotificationLink.ISSUE}
