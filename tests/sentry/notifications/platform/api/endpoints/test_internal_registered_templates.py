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

    def test_get_registered_templates(self) -> None:
        self.login_as(self.user)
        response = self.get_response()
        assert response.status_code == 200
        for source, template_cls in template_registry.registrations.items():
            template = template_cls()
            assert template.category.value in response.data
            assert (
                serialize_template(template=template, source=source)
                in response.data[template.category.value]
            )


class SerializeSlackPreviewTest(TestCase):
    def setUp(self):
        self.template = MockNotificationTemplate()

    def test_serialize_slack_preview_complete(self):
        """Test complete serialization of Slack preview with all components"""
        result = serialize_slack_preview(self.template)

        # Should return a dict with blocks key
        assert isinstance(result, dict)
        assert "blocks" in result
        assert isinstance(result["blocks"], list)

        blocks = result["blocks"]
        assert len(blocks) >= 4  # header, body, actions, footer, image

        # Check header block
        header_block = blocks[0]
        assert header_block["type"] == "header"
        assert header_block["text"]["type"] == "plain_text"
        assert header_block["text"]["text"] == "Mock Notification"

        # Check body block
        body_block = blocks[1]
        assert body_block["type"] == "section"
        assert body_block["text"]["type"] == "mrkdwn"
        assert body_block["text"]["text"] == "This is a mock notification"

        # Check actions block exists
        actions_block = next((block for block in blocks if block["type"] == "actions"), None)
        assert actions_block is not None
        assert len(actions_block["elements"]) > 0
        button = actions_block["elements"][0]
        assert button["type"] == "button"
        assert button["text"]["text"] == "Visit Sentry"
        assert button["url"] == "https://www.sentry.io"

        # Check footer block exists
        footer_blocks = [
            block
            for block in blocks
            if block["type"] == "section"
            and block.get("text", {}).get("text") == "This is a mock footer"
        ]
        assert len(footer_blocks) > 0

        # Check image block exists
        image_block = next((block for block in blocks if block["type"] == "image"), None)
        assert image_block is not None
        assert "bufo-pog.png" in image_block["image_url"]
        assert image_block["alt_text"] == "Bufo Pog"

        # Verify all blocks are properly serialized dictionaries
        for block in blocks:
            assert isinstance(block, dict)
            assert "type" in block
            assert isinstance(block["type"], str)


class SerializeTemplateTest(TestCase):
    def test_serialize_template_form(self):
        """Test that serialize_template returns the correct structure"""
        template = MockNotificationTemplate()
        source = "test-source"

        result = serialize_template(template=template, source=source)

        # Verify top-level structure
        assert isinstance(result, dict)
        assert "source" in result
        assert "category" in result
        assert "example" in result
        assert "previews" in result

        # Verify values
        assert result["source"] == source
        assert result["category"] == template.category

        # Verify example structure
        example = result["example"]
        assert "subject" in example
        assert "body" in example
        assert "actions" in example
        assert isinstance(example["actions"], list)

        previews = result["previews"]

        # validate slack preview in payload
        assert "slack" in previews
        slack_preview = previews["slack"]
        assert "blocks" in slack_preview
        assert isinstance(slack_preview["blocks"], list)
