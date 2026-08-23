from unittest.mock import patch

from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.issues.grouptype import FeedbackGroup
from sentry.testutils.cases import TestCase


class SlackIssueTitleTest(TestCase):
    def test_multiline_feedback_title_is_single_line_in_link_label(self) -> None:
        group = self.create_group(project=self.project)
        group.type = FeedbackGroup.type_id
        group.save(update_fields=["type"])

        builder = SlackIssuesMessageBuilder(group)
        title = "User Feedback: the app freezes on checkout\n\nreproduced twice"

        with patch(
            "sentry.integrations.slack.message_builder.issues.build_attachment_title",
            return_value=title,
        ):
            block = builder.get_title_block(
                group,
                has_action=False,
                title_link="https://example.com/feedback",
            )

        rendered_title = block["text"]["text"]
        assert "\n" not in rendered_title
        assert (
            "<https://example.com/feedback|*User Feedback: the app freezes on checkout  reproduced twice*>"
            in rendered_title
        )
