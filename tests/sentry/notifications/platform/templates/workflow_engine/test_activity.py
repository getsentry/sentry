from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.notifications.platform.templates.workflow_engine.activity import (
    ACTIVITY_TYPE_TO_SOURCE,
)
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    build_alert_footer,
    build_issue_link,
)
from sentry.notifications.platform.templates.workflow_engine.activity.seer.base import (
    get_issue_description,
    get_subject,
    get_view_autofix_button,
)
from sentry.notifications.platform.templates.workflow_engine.activity.set_resolved.base import (
    get_resolution_subject,
)
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationRenderedAction,
    NotificationTextBlockType,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class ActivityAlertBaseTest(TestCase):
    def test_all_seer_activity_types_mapped(self) -> None:
        seer_types = [
            ActivityType.SEER_RCA_STARTED,
            ActivityType.SEER_RCA_COMPLETED,
            ActivityType.SEER_SOLUTION_STARTED,
            ActivityType.SEER_SOLUTION_COMPLETED,
            ActivityType.SEER_CODING_STARTED,
            ActivityType.SEER_CODING_COMPLETED,
            ActivityType.SEER_PR_CREATED,
            ActivityType.SEER_ITERATION_STARTED,
            ActivityType.SEER_ITERATION_COMPLETED,
        ]
        for activity_type in seer_types:
            assert activity_type.value in ACTIVITY_TYPE_TO_SOURCE

    def test_all_resolved_activity_types_mapped(self) -> None:
        resolved_types = [
            ActivityType.SET_RESOLVED,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ActivityType.SET_RESOLVED_BY_AGE,
            ActivityType.SET_RESOLVED_IN_COMMIT,
        ]
        for activity_type in resolved_types:
            assert activity_type.value in ACTIVITY_TYPE_TO_SOURCE

    def test_build_alert_footer(self) -> None:
        footer = build_alert_footer(self.organization, workflow_id=42)
        assert len(footer) == 2
        assert footer[0].type == NotificationTextBlockType.PLAIN_TEXT
        assert "sent as part of" in footer[0].text
        assert isinstance(footer[1], LinkTextBlock)
        assert "42" in footer[1].url
        assert self.organization.slug in footer[1].url

    def test_build_issue_link(self) -> None:
        group = self.create_group()
        assert group.qualified_short_id is not None
        label = build_issue_link(group)
        assert label.type == NotificationTextBlockType.LINK
        assert label.text == group.qualified_short_id


class ActivitySeerAlertBaseTest(TestCase):
    def test_get_subject_with_qualified_short_id(self) -> None:
        group = self.create_group()
        assert group.qualified_short_id is not None
        subject = get_subject("Root Cause Analysis Started", group)
        assert len(subject) == 2
        assert subject[0].text == "Root Cause Analysis Started for"
        assert subject[1].type == NotificationTextBlockType.CODE
        assert subject[1].text == group.qualified_short_id

    def test_get_subject_without_qualified_short_id(self) -> None:
        group = Group(short_id=None)
        subject = get_subject("Root Cause Analysis Started", group)
        assert len(subject) == 1
        assert "a Sentry Issue" in subject[0].text

    def test_get_issue_description(self) -> None:
        group = self.create_group(culprit="app.tasks.process")
        sections = get_issue_description(group)
        assert len(sections) == 1
        blocks = sections[0].blocks
        assert blocks[0].type == NotificationTextBlockType.LINK
        assert any(
            b.type == NotificationTextBlockType.CODE and b.text == "app.tasks.process"
            for b in blocks
        )

    def test_get_issue_description_no_culprit(self) -> None:
        group = self.create_group(culprit="")
        sections = get_issue_description(group)
        blocks = sections[0].blocks
        assert not any(b.type == NotificationTextBlockType.CODE for b in blocks)

    def test_get_view_autofix_button(self) -> None:
        group = self.create_group()
        action = get_view_autofix_button(group)
        assert isinstance(action, NotificationRenderedAction)
        assert action.label == "View Autofix"
        assert "seerDrawer=true" in action.link


class ActivitySetResolvedAlertBaseTest(TestCase):
    def test_get_resolution_subject_with_short_id(self) -> None:
        group = self.create_group()
        assert group.qualified_short_id is not None
        activity = Activity.objects.create(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
        )
        subject = get_resolution_subject(activity, group)
        assert subject[0].type == NotificationTextBlockType.CODE
        assert subject[0].text == group.qualified_short_id
        assert "was resolved" in subject[1].text

    def test_get_resolution_subject_without_short_id(self) -> None:
        group = Group(short_id=None)
        activity = Activity.objects.create(
            project=self.project,
            group=self.create_group(),
            type=ActivityType.SET_RESOLVED.value,
        )
        subject = get_resolution_subject(activity, group)
        assert len(subject) == 1
        assert "A Sentry Issue was resolved" in subject[0].text

    def test_get_resolution_subject_with_user(self) -> None:
        group = self.create_group()
        activity = Activity.objects.create(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        subject = get_resolution_subject(activity, group)
        assert any(
            "by" in b.text for b in subject if b.type == NotificationTextBlockType.PLAIN_TEXT
        )
