from sentry.notifications.platform.templates.activity import (
    ACTIVITY_TYPE_TO_SOURCE,
)
from sentry.notifications.platform.templates.activity.base import (
    EXAMPLE_ALERT_URL,
    EXAMPLE_ISSUE_URL,
    EXAMPLE_PROJECT_URL,
    EXAMPLE_USER_SETTINGS_URL,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.seer.base import (
    get_subject,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_status_change_subject,
)
from sentry.notifications.platform.types import (
    LinkTextBlock,
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

    def test_build_footer(self) -> None:
        footer = build_footer(
            data=create_activity_notification_example(ActivityType.SEER_RCA_STARTED)
        )
        assert footer[0].type == NotificationTextBlockType.PLAIN_TEXT
        assert footer[0].text == "Project:"
        assert isinstance(footer[1], LinkTextBlock)
        assert footer[1].text == "javascript"
        assert footer[1].url == EXAMPLE_PROJECT_URL
        assert isinstance(footer[4], LinkTextBlock)
        assert footer[4].url == EXAMPLE_ALERT_URL
        assert isinstance(footer[6], LinkTextBlock)
        assert footer[6].text == "Manage Preferences"
        assert footer[6].url == EXAMPLE_USER_SETTINGS_URL

    def test_build_footer_no_alert(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"alert_name": None, "alert_url": None}
        )
        footer = build_footer(data=data)
        assert not any(isinstance(b, LinkTextBlock) and b.url == EXAMPLE_ALERT_URL for b in footer)

    def test_build_issue_link(self) -> None:
        label = build_issue_link(issue_short_id="PROJ-1", issue_url=EXAMPLE_ISSUE_URL)
        assert label.type == NotificationTextBlockType.LINK
        assert label.text == "PROJ-1"

    def test_build_issue_link_no_short_id(self) -> None:
        label = build_issue_link(issue_short_id=None, issue_url=EXAMPLE_ISSUE_URL)
        assert label.text == "This issue"

    def test_get_issue_description(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED)
        sections = get_issue_description(data)
        assert len(sections) == 2
        blocks = sections[0].blocks
        assert blocks[0].type == NotificationTextBlockType.LINK
        assert any(
            b.type == NotificationTextBlockType.CODE and b.text == "/api/v1/users/list/"
            for b in blocks
        )
        assert (
            sections[1].blocks[0].text
            == "Cannot read properties of null (reading 'example_property')"
        )

    def test_get_issue_description_no_culprit(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"issue_culprit": None}
        )
        sections = get_issue_description(data)
        blocks = sections[0].blocks
        assert not any(b.type == NotificationTextBlockType.CODE for b in blocks)


class ActivitySeerAlertBaseTest(TestCase):
    def test_get_subject_with_qualified_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED)
        subject = get_subject("Root Cause Analysis Started", data)
        assert len(subject) == 2
        assert subject[0].text == "Root Cause Analysis Started for"
        assert subject[1].type == NotificationTextBlockType.CODE
        assert subject[1].text == "JAVASCRIPT-1"

    def test_get_subject_without_qualified_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"issue_short_id": None}
        )
        subject = get_subject("Root Cause Analysis Started", data)
        assert len(subject) == 1
        assert "a Sentry Issue" in subject[0].text


class ActivitySetResolvedAlertBaseTest(TestCase):
    def test_get_status_change_subject_with_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED)
        subject = get_status_change_subject(data)
        assert subject[0].type == NotificationTextBlockType.CODE
        assert subject[0].text == "JAVASCRIPT-1"
        assert "was resolved" in subject[1].text

    def test_get_status_change_subject_without_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED).copy(
            update={"issue_short_id": None, "activity_user_name": None}
        )
        subject = get_status_change_subject(data)
        assert len(subject) == 1
        assert "A Sentry Issue was resolved" in subject[0].text

    def test_get_status_change_subject_with_user(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED)
        subject = get_status_change_subject(data)
        assert any(
            "by Jane Doe" in b.text
            for b in subject
            if b.type == NotificationTextBlockType.PLAIN_TEXT
        )
