from sentry.notifications.platform.templates.activity import (
    ACTIVITY_TYPE_TO_SOURCE,
)
from sentry.notifications.platform.templates.activity.base import (
    EXAMPLE_ALERT_URL,
    EXAMPLE_ISSUE_URL,
    build_footer,
    build_issue_link,
    create_activity_alert_example,
)
from sentry.notifications.platform.templates.activity.seer.base import (
    get_issue_description,
    get_subject,
    get_view_autofix_button,
)
from sentry.notifications.platform.templates.activity.set_resolved.base import (
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
        footer = build_footer(data=create_activity_alert_example(ActivityType.SEER_RCA_STARTED))
        # @claude update this test
        assert len(footer) == 2
        assert footer[0].type == NotificationTextBlockType.PLAIN_TEXT
        assert "sent as part of" in footer[0].text
        assert isinstance(footer[1], LinkTextBlock)
        assert footer[1].url == EXAMPLE_ALERT_URL

    def test_build_issue_link(self) -> None:
        label = build_issue_link(issue_short_id="PROJ-1", issue_url=EXAMPLE_ISSUE_URL)
        assert label.type == NotificationTextBlockType.LINK
        assert label.text == "PROJ-1"

    def test_build_issue_link_no_short_id(self) -> None:
        label = build_issue_link(issue_short_id=None, issue_url=EXAMPLE_ISSUE_URL)
        assert label.text == "This issue"


class ActivitySeerAlertBaseTest(TestCase):
    def test_get_subject_with_qualified_short_id(self) -> None:
        data = create_activity_alert_example(ActivityType.SEER_RCA_STARTED)
        subject = get_subject("Root Cause Analysis Started", data)
        assert len(subject) == 2
        assert subject[0].text == "Root Cause Analysis Started for"
        assert subject[1].type == NotificationTextBlockType.CODE
        assert subject[1].text == "EXAMPLE-1"

    def test_get_subject_without_qualified_short_id(self) -> None:
        data = create_activity_alert_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"issue_short_id": None}
        )
        subject = get_subject("Root Cause Analysis Started", data)
        assert len(subject) == 1
        assert "a Sentry Issue" in subject[0].text

    def test_get_issue_description(self) -> None:
        data = create_activity_alert_example(ActivityType.SEER_RCA_STARTED)
        sections = get_issue_description(data)
        assert len(sections) == 1
        blocks = sections[0].blocks
        assert blocks[0].type == NotificationTextBlockType.LINK
        assert any(
            b.type == NotificationTextBlockType.CODE and b.text == "example.module.function"
            for b in blocks
        )

    def test_get_issue_description_no_culprit(self) -> None:
        data = create_activity_alert_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"issue_culprit": None}
        )
        sections = get_issue_description(data)
        blocks = sections[0].blocks
        assert not any(b.type == NotificationTextBlockType.CODE for b in blocks)

    def test_get_view_autofix_button(self) -> None:
        data = create_activity_alert_example(ActivityType.SEER_RCA_STARTED)
        action = get_view_autofix_button(data)
        assert isinstance(action, NotificationRenderedAction)
        assert action.label == "View Autofix"
        assert "seerDrawer=true" in action.link


class ActivitySetResolvedAlertBaseTest(TestCase):
    def test_get_resolution_subject_with_short_id(self) -> None:
        data = create_activity_alert_example(ActivityType.SET_RESOLVED)
        subject = get_resolution_subject(data)
        assert subject[0].type == NotificationTextBlockType.CODE
        assert subject[0].text == "EXAMPLE-1"
        assert "was resolved" in subject[1].text

    def test_get_resolution_subject_without_short_id(self) -> None:
        data = create_activity_alert_example(ActivityType.SET_RESOLVED).copy(
            update={"issue_short_id": None, "activity_user_name": None}
        )
        subject = get_resolution_subject(data)
        assert len(subject) == 1
        assert "A Sentry Issue was resolved" in subject[0].text

    def test_get_resolution_subject_with_user(self) -> None:
        data = create_activity_alert_example(ActivityType.SET_RESOLVED)
        subject = get_resolution_subject(data)
        assert any(
            "by Jane Doe" in b.text
            for b in subject
            if b.type == NotificationTextBlockType.PLAIN_TEXT
        )
