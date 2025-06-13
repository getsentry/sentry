from dataclasses import dataclass
from typing import Any

from sentry.models.organizationmember import InviteStatus
from sentry.platform_example.notification_types import NotificationType
from sentry.platform_example.real_world_example.user_invite_notification import (
    OrganizationInviteNotificationData,
    OrganizationInviteNotificationTemplate,
)
from sentry.platform_example.template_base import (
    DjangoNotificationTemplate,
    EmailTemplate,
    IntegrationTemplate,
    TemplateData,
)
from sentry.testutils.cases import TestCase


@dataclass
class DataTest(TemplateData):
    foo: str
    head: str

    def to_dict(self) -> dict[str, Any]:
        return {"foo": self.foo, "head": self.head}


TemplateTester = DjangoNotificationTemplate[DataTest](
    email_template=EmailTemplate(
        body_template_path="sentry/emails/test_template.html",
        subject_template_path="sentry/emails/test_template.txt",
        body_plaintext_template_path="sentry/emails/test_template.txt",
    ),
    integration_template=IntegrationTemplate(
        body_template_path="sentry/integrations/test_template.txt",
        subject_template_path="sentry/integrations/test_template.txt",
    ),
    notification_type=NotificationType.OrganizationInvite,
)


class TestTemplateBase(TestCase):
    def test_render(self):
        rendered_output = TemplateTester.render_email_template(DataTest(foo="bar", head="head"))

        assert (
            rendered_output.body.replace("\n", "").replace(" ", "")
            == "<html><head>head</head><body>bar</body></html>"
        )


class TestMemberInviteNotification(TestCase):
    def test_render(self):
        inviter = self.create_user(email="inviter@example.com", name="Manager Person")
        member_invite = self.create_member(
            email="example@example.com",
            organization=self.organization,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
            inviter_id=inviter.id,
        )
        OrganizationInviteNotificationTemplate.render_email_template(
            OrganizationInviteNotificationData.from_member_invite(member_invite)
        )
