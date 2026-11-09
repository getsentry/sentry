from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.inbox import (
    InboxItemNotificationData,
    InboxItemNotificationTemplate,
)
from sentry.notifications.platform.types import (
    BoldTextBlock,
    NotificationCategory,
    NotificationRenderedAction,
    NotificationSource,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.testutils.cases import TestCase


class InboxItemNotificationTemplateTest(TestCase):
    def test_template_registered(self) -> None:
        assert template_registry.get(NotificationSource.INBOX_ITEM) is InboxItemNotificationTemplate
        assert InboxItemNotificationTemplate.category == NotificationCategory.INBOX

    def test_render(self) -> None:
        data = InboxItemNotificationData(
            organization_id=1,
            inbox_item_id=2,
            event_type="issue.user_assigned",
            subject_title="TypeError: x is undefined",
            summary="Assigned to you",
            actor_name="Jane Doe",
            inbox_url="https://sentry.io/organizations/acme/inbox/issue/3/",
        )

        rendered = InboxItemNotificationTemplate().render(data)

        assert rendered.subject == "TypeError: x is undefined"
        assert rendered.body == [
            ParagraphSection(
                blocks=[BoldTextBlock(text="Jane Doe:"), PlainTextBlock(text="Assigned to you")]
            )
        ]
        assert rendered.actions == [
            NotificationRenderedAction(
                label="View in Inbox", link="https://sentry.io/organizations/acme/inbox/issue/3/"
            )
        ]
