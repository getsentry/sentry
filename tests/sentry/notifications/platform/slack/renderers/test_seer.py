from unittest.mock import Mock, patch

from django.test import override_settings
from slack_sdk.models.blocks import (
    ActionsBlock,
    ButtonElement,
    ContextBlock,
    LinkButtonElement,
    PlainTextObject,
    SectionBlock,
)

from fixtures.seer.webhooks import MOCK_GROUP_ID, MOCK_RUN_ID
from sentry.notifications.platform.slack.renderers.seer import AUTOFIX_CONFIG, SeerSlackRenderer
from sentry.notifications.platform.templates.seer import (
    SeerAutofixCodeChange,
    SeerAutofixPullRequest,
    SeerAutofixUpdate,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.testutils.cases import TestCase


class SeerSlackRendererTest(TestCase):
    def _create_update(
        self,
        current_point: AutofixStoppingPoint,
        summary: str | None = None,
        steps: list[str] | None = None,
        changes: list[SeerAutofixCodeChange] | None = None,
        pull_requests: list[SeerAutofixPullRequest] | None = None,
    ) -> SeerAutofixUpdate:
        return SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=MOCK_GROUP_ID,
            current_point=current_point,
            group_link=f"https://sentry.io/issues/{MOCK_GROUP_ID}?seerDrawer=true",
            summary=summary,
            steps=steps or [],
            changes=changes or [],
            pull_requests=pull_requests or [],
        )

    def test_render_footer_blocks_with_has_complete_stage(self) -> None:
        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        blocks = SeerSlackRenderer.render_footer_blocks(data=data, has_complete_stage=True)
        assert len(blocks) == 1
        config = AUTOFIX_CONFIG[AutofixStoppingPoint.ROOT_CAUSE]
        completed_text = config["completed_text"]
        assert completed_text is not None
        section_block = blocks[0]
        assert isinstance(section_block, SectionBlock)
        assert section_block.text is not None
        assert completed_text in section_block.text.text
        assert section_block.accessory is not None
        assert isinstance(section_block.accessory, LinkButtonElement)
        assert section_block.accessory.url == data.group_link

    def test_render_footer_blocks_with_stage_not_completed(self) -> None:
        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        blocks = SeerSlackRenderer.render_footer_blocks(data=data, has_complete_stage=False)
        assert len(blocks) == 1
        config = AUTOFIX_CONFIG[AutofixStoppingPoint.ROOT_CAUSE]
        working_text = config["working_text"]
        assert working_text is not None
        section_block = blocks[0]
        assert isinstance(section_block, SectionBlock)
        assert section_block.text is not None
        assert working_text in section_block.text.text

    def test_render_footer_blocks_with_extra_text(self) -> None:
        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        extra_text = "(ty <@U12345>)"
        blocks = SeerSlackRenderer.render_footer_blocks(data=data, extra_text=extra_text)
        assert len(blocks) == 1
        section_block = blocks[0]
        assert isinstance(section_block, SectionBlock)
        assert section_block.text is not None
        assert extra_text in section_block.text.text

    @override_settings(DEBUG=True)
    def test_render_footer_debug_block(self) -> None:
        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        blocks = SeerSlackRenderer.render_footer_blocks(data=data)
        assert len(blocks) == 2
        assert isinstance(blocks[1], ContextBlock)
        context_element = blocks[1].elements[0]
        assert isinstance(context_element, PlainTextObject)
        assert f"Run ID: {MOCK_RUN_ID}" in context_element.text

    def test_render_autofix_button(self) -> None:
        element = SeerSlackRenderer.render_autofix_button(group=self.group)
        assert isinstance(element, ButtonElement)
        assert element.text is not None
        assert element.text.text == "Fix with Seer"
        assert element.value == AutofixStoppingPoint.ROOT_CAUSE.value

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=True,
    )
    def test_render_autofix_update_no_progress_with_next_trigger(
        self, _mock_get_option: Mock
    ) -> None:
        data = self._create_update(
            current_point=AutofixStoppingPoint.ROOT_CAUSE,
            summary="Test summary",
        )
        renderable = SeerSlackRenderer._render_autofix_update(data)
        # Should have link button and next stage trigger button
        actions_block = None
        for block in renderable["blocks"]:
            if isinstance(block, ActionsBlock):
                actions_block = block
                break
        assert actions_block is not None
        assert len(actions_block.elements) == 2
        # First button is link to sentry
        assert isinstance(actions_block.elements[0], LinkButtonElement)
        # Second button is trigger for next stage
        assert isinstance(actions_block.elements[1], ButtonElement)
        assert actions_block.elements[1].value == AutofixStoppingPoint.SOLUTION.value

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=True,
    )
    def test_render_autofix_update_open_pr_no_footer(self, _mock_get_option: Mock) -> None:
        data = self._create_update(
            current_point=AutofixStoppingPoint.OPEN_PR,
            pull_requests=[{"pr_number": 123, "pr_url": "https://github.com/org/repo/pull/123"}],
        )
        renderable = SeerSlackRenderer._render_autofix_update(data)
        # Open PR with progress should NOT have footer (it's the final stage)
        has_context_block = any(isinstance(b, ContextBlock) for b in renderable["blocks"])
        assert not has_context_block

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=True,
    )
    def test_render_autofix_update_with_pull_requests(self, _mock_get_option: Mock) -> None:
        data = self._create_update(
            current_point=AutofixStoppingPoint.OPEN_PR,
            pull_requests=[
                {"pr_number": 123, "pr_url": "https://github.com/org/repo/pull/123"},
                {"pr_number": 456, "pr_url": "https://github.com/org/repo/pull/456"},
            ],
        )
        renderable = SeerSlackRenderer._render_autofix_update(data)
        actions_block = None
        for block in renderable["blocks"]:
            if isinstance(block, ActionsBlock):
                actions_block = block
                break
        assert actions_block is not None
        # Should have link button + 2 PR buttons
        pr_buttons = [
            e
            for e in actions_block.elements
            if isinstance(e, LinkButtonElement) and e.text is not None and "PR" in e.text.text
        ]
        assert len(pr_buttons) == 2

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=False,
    )
    def test_render_autofix_update_solution_no_next_trigger_when_coding_disabled(
        self, _mock_get_option: Mock
    ) -> None:
        data = self._create_update(current_point=AutofixStoppingPoint.SOLUTION)
        renderable = SeerSlackRenderer._render_autofix_update(data)
        actions_block = None
        for block in renderable["blocks"]:
            if isinstance(block, ActionsBlock):
                actions_block = block
                break
        assert actions_block is not None
        # Should only have link button, no next trigger button
        assert len(actions_block.elements) == 1
        assert isinstance(actions_block.elements[0], LinkButtonElement)
