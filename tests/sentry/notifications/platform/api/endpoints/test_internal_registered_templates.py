from typing import Any

from sentry.notifications.platform.api.endpoints.internal_registered_templates import (
    serialize_slack_preview,
    serialize_template,
)
from sentry.notifications.platform.registry import template_registry
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.notifications.platform import MockNotificationTemplate
from sentry.testutils.silo import control_silo_test


@control_silo_test
class InternalRegisteredTemplatesEndpointTest(APITestCase):
    endpoint = "internal-notifications-registered-templates"

    def test_unauthenticated(self) -> None:
        response = self.get_response()
        assert response.status_code == 401

    def test_get_all_registered_templates(self) -> None:
        self.login_as(self.user)
        response = self.get_response()
        assert response.status_code == 200
        for source, template_cls in template_registry.registrations.items():
            if template_cls.hide_from_debugger:
                continue
            template = template_cls()
            assert template.category.value in response.data
            assert (
                serialize_template(template=template, source=source)
                in response.data[template.category.value]
            )

    def test_valid_template_serialization(self) -> None:
        self.login_as(self.user)
        response = self.get_response()
        for templates_by_category in response.data.values():
            for template in templates_by_category:
                assert "source" in template
                assert "category" in template
                # The template registry should reflect the same source and category
                template_cls = template_registry.get(template["source"])
                assert template_cls.category.value == template["category"]
                # The response should be nested in the proper category
                assert response.data[template["category"]] == templates_by_category
                assert "example" in template
                assert "previews" in template
                assert "email" in template["previews"]
                assert "slack" in template["previews"]

    def test_email_preview(self) -> None:
        self.login_as(self.user)
        response = self.get_response()
        for templates_by_category in response.data.values():
            for template in templates_by_category:
                assert "email" in template["previews"]
                assert isinstance(template["previews"]["email"]["subject"], str)
                assert isinstance(template["previews"]["email"]["text_content"], str)
                assert isinstance(template["previews"]["email"]["html_content"], str)

    def test_discord_preview(self) -> None:
        self.login_as(self.user)
        response = self.get_response()
        for templates_by_category in response.data.values():
            for template in templates_by_category:
                assert "discord" in template["previews"]
                if template["example"]["actions"]:
                    num_actions = len(template["example"]["actions"])
                    # The first component is an action row, the contents of the row are the buttons
                    assert (
                        len(template["previews"]["discord"]["components"][0]["components"])
                        == num_actions
                    )
                assert template["previews"]["discord"]["content"] == ""
                assert len(template["previews"]["discord"]["embeds"]) == 1


def find_block_by_type(blocks: list[dict[str, Any]], block_type: str) -> dict[str, Any] | None:
    """Find the first block with the specified type."""
    return next((block for block in blocks if block["type"] == block_type), None)


def assert_header_block(block: dict[str, Any], expected_text: str) -> None:
    """Assert that a block is a valid header block with expected text."""
    assert block["type"] == "header"
    assert block["text"]["type"] == "plain_text"
    assert block["text"]["text"] == expected_text


def assert_section_block(
    block: dict[str, Any], expected_text: str, text_type: str = "mrkdwn"
) -> None:
    """Assert that a block is a valid section block with expected text."""
    assert block["type"] == "section"
    assert block["text"]["type"] == text_type
    assert block["text"]["text"] == expected_text


def assert_button_element(element: dict[str, Any], expected_text: str, expected_url: str) -> None:
    """Assert that an element is a valid button with expected text and URL."""
    assert element["type"] == "button"
    assert element["text"]["text"] == expected_text
    assert element["url"] == expected_url


def assert_image_block(block: dict[str, Any], expected_url: str, expected_alt_text: str) -> None:
    """Assert that a block is a valid image block with expected URL and alt text."""
    assert block["type"] == "image"
    assert block["image_url"] == expected_url
    assert block["alt_text"] == expected_alt_text


def find_section_block_by_text(
    blocks: list[dict[str, Any]], text_content: str
) -> dict[str, Any] | None:
    """Find a section block that contains specific text content."""
    return next(
        (
            block
            for block in blocks
            if block["type"] == "section" and block.get("text", {}).get("text") == text_content
        ),
        None,
    )


class SerializeSlackPreviewTest(TestCase):
    def setUp(self) -> None:
        self.template = MockNotificationTemplate()

    def test_serialize_slack_preview_complete(self) -> None:
        """Test complete serialization of Slack preview with all components"""
        result = serialize_slack_preview(self.template)

        # Should return a dict with blocks key
        assert isinstance(result, dict)
        assert "blocks" in result
        assert isinstance(result["blocks"], list)

        blocks = result["blocks"]
        assert len(blocks) >= 4  # header, body, actions, footer, image

        # Check header block
        assert_header_block(blocks[0], "Mock Notification")

        # Check body block
        assert_section_block(blocks[1], "This is a mock notification")

        # Check actions block exists
        actions_block = find_block_by_type(blocks, "actions")
        assert actions_block is not None
        assert len(actions_block["elements"]) > 0
        assert_button_element(actions_block["elements"][0], "Visit Sentry", "https://www.sentry.io")

        # Check footer block exists
        footer_block = find_block_by_type(blocks, "context")
        assert footer_block is not None

        # Check image block exists
        image_block = find_block_by_type(blocks, "image")
        assert image_block is not None
        assert_image_block(image_block, image_block["image_url"], "Bufo Pog")
        assert "bufo-pog.png" in image_block["image_url"]

        # Verify all blocks are properly serialized dictionaries
        for block in blocks:
            assert isinstance(block, dict)
            assert "type" in block
            assert isinstance(block["type"], str)
