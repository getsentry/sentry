from unittest.mock import Mock, patch

import pytest

from fixtures.seer.webhooks import MOCK_GROUP_ID, MOCK_RUN_ID
from sentry.constants import ENABLE_SEER_CODING_DEFAULT
from sentry.notifications.platform.templates.seer import (
    OUT_OF_CREDITS_MESSAGE,
    SeerAgentError,
    SeerAutofixTrigger,
    SeerAutofixUpdate,
    SeerInvestigationConclusionTemplate,
    SeerInvestigationError,
    SeerInvestigationErrorTemplate,
    SeerInvestigationStarted,
    SeerInvestigationStartedTemplate,
    SeerInvestigationStatusTemplate,
    SeerOutOfCredits,
    SeerOutOfCreditsTemplate,
    _get_next_stopping_point,
)
from sentry.notifications.platform.types import ParagraphSection
from sentry.seer.autofix.utils import AutofixStoppingPoint, CodingAgentProviderType
from sentry.testutils.cases import TestCase


class SeerTemplatesTest(TestCase):
    def test_get_next_stopping_point(self) -> None:
        assert (
            _get_next_stopping_point(AutofixStoppingPoint.ROOT_CAUSE)
            == AutofixStoppingPoint.SOLUTION
        )
        assert (
            _get_next_stopping_point(AutofixStoppingPoint.SOLUTION)
            == AutofixStoppingPoint.CODE_CHANGES
        )
        assert (
            _get_next_stopping_point(AutofixStoppingPoint.CODE_CHANGES)
            == AutofixStoppingPoint.OPEN_PR
        )
        assert _get_next_stopping_point(AutofixStoppingPoint.OPEN_PR) is None


class SeerAutofixTriggerTest(TestCase):
    def _create_update(self, current_point: AutofixStoppingPoint) -> SeerAutofixUpdate:
        return SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=MOCK_GROUP_ID,
            current_point=current_point,
            group_link=f"https://sentry.io/issues/{MOCK_GROUP_ID}?seerDrawer=true",
        )

    def test_from_update(self) -> None:
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        trigger = SeerAutofixTrigger.from_update(update)
        assert trigger.stopping_point == AutofixStoppingPoint.SOLUTION
        assert trigger.group_id == update.group_id
        assert trigger.project_id == update.project_id
        assert trigger.organization_id == update.organization_id

        update = self._create_update(AutofixStoppingPoint.SOLUTION)
        trigger = SeerAutofixTrigger.from_update(update)
        assert trigger.stopping_point == AutofixStoppingPoint.CODE_CHANGES

        update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        trigger = SeerAutofixTrigger.from_update(update)
        assert trigger.stopping_point == AutofixStoppingPoint.OPEN_PR

        update = self._create_update(AutofixStoppingPoint.OPEN_PR)
        with pytest.raises(ValueError, match="No next stopping point"):
            SeerAutofixTrigger.from_update(update)


class SeerAutofixUpdateTest(TestCase):
    def _create_update(self, current_point: AutofixStoppingPoint) -> SeerAutofixUpdate:
        return SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=MOCK_GROUP_ID,
            current_point=current_point,
            group_link=f"https://sentry.io/issues/{MOCK_GROUP_ID}?seerDrawer=true",
        )

    def test_has_next_trigger_simple(self) -> None:
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        assert update.has_next_trigger is True
        update = self._create_update(AutofixStoppingPoint.OPEN_PR)
        assert update.has_next_trigger is False

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=True,
    )
    def test_next_seer_stopping_point(self, _mock_get_option: Mock) -> None:
        assert (
            self._create_update(AutofixStoppingPoint.ROOT_CAUSE).next_seer_stopping_point
            == AutofixStoppingPoint.SOLUTION
        )
        assert (
            self._create_update(AutofixStoppingPoint.SOLUTION).next_seer_stopping_point
            == AutofixStoppingPoint.CODE_CHANGES
        )
        assert (
            self._create_update(AutofixStoppingPoint.CODE_CHANGES).next_seer_stopping_point
            == AutofixStoppingPoint.OPEN_PR
        )
        assert self._create_update(AutofixStoppingPoint.OPEN_PR).next_seer_stopping_point is None

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=False,
    )
    def test_next_seer_stopping_point_coding_disabled(self, _mock_get_option: Mock) -> None:
        assert (
            self._create_update(AutofixStoppingPoint.ROOT_CAUSE).next_seer_stopping_point
            == AutofixStoppingPoint.SOLUTION
        )
        assert self._create_update(AutofixStoppingPoint.SOLUTION).next_seer_stopping_point is None
        assert (
            self._create_update(AutofixStoppingPoint.CODE_CHANGES).next_seer_stopping_point is None
        )

    @patch(
        "sentry.notifications.platform.templates.seer.organization_service.get_option",
        return_value=True,
    )
    def test_next_seer_stopping_point_with_handoff(self, _mock_get_option: Mock) -> None:
        handoff = {"handoff_target": CodingAgentProviderType.CURSOR_BACKGROUND_AGENT}
        root_cause = self._create_update(AutofixStoppingPoint.ROOT_CAUSE).copy(update=handoff)
        assert root_cause.next_seer_stopping_point is None
        # The handoff button only replaces the next-step button at root cause.
        solution = self._create_update(AutofixStoppingPoint.SOLUTION).copy(update=handoff)
        assert solution.next_seer_stopping_point == AutofixStoppingPoint.CODE_CHANGES

    def test_next_seer_stopping_point_ignores_credits(self) -> None:
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE).copy(
            update={"has_credits_for_next_step": False}
        )
        assert update.next_seer_stopping_point == AutofixStoppingPoint.SOLUTION

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_coding_disabled(self, mock_get_option: Mock) -> None:
        mock_get_option.return_value = False
        solution_update = self._create_update(AutofixStoppingPoint.SOLUTION)
        coding_update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert solution_update.has_next_trigger is False
        assert coding_update.has_next_trigger is False

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_coding_enabled(self, mock_get_option: Mock) -> None:
        mock_get_option.return_value = True
        solution_update = self._create_update(AutofixStoppingPoint.SOLUTION)
        coding_update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert solution_update.has_next_trigger is True
        assert coding_update.has_next_trigger is True

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_coding_default(self, mock_get_option: Mock) -> None:
        mock_get_option.return_value = None
        solution_update = self._create_update(AutofixStoppingPoint.SOLUTION)
        coding_update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert solution_update.has_next_trigger is ENABLE_SEER_CODING_DEFAULT
        assert coding_update.has_next_trigger is ENABLE_SEER_CODING_DEFAULT


class SeerAgentErrorTemplateTest(TestCase):
    def test_render(self) -> None:
        from sentry.notifications.platform.templates.seer import SeerAgentErrorTemplate

        data = SeerAgentError(
            organization_id=1, error_message="Seer could not explore your organization."
        )
        template = SeerAgentErrorTemplate()
        rendered = template.render(data)

        assert rendered.subject == "Seer had some trouble..."
        assert len(rendered.body) == 1
        assert isinstance(rendered.body[0], ParagraphSection)
        assert rendered.body[0].blocks[0].text == "Seer could not explore your organization."

    def test_render_custom_title(self) -> None:
        from sentry.notifications.platform.templates.seer import SeerAgentErrorTemplate

        data = SeerAgentError(
            organization_id=1,
            error_message="Timeout.",
            error_title="Agent failed",
        )
        template = SeerAgentErrorTemplate()
        rendered = template.render(data)

        assert rendered.subject == "Agent failed"
        assert rendered.body[0].blocks[0].text == "Timeout."


class SeerOutOfCreditsTemplateTest(TestCase):
    def test_render(self) -> None:
        for started in (False, True):
            rendered = SeerOutOfCreditsTemplate().render(
                SeerOutOfCredits(organization_id=1, started=started)
            )

            assert rendered.subject == OUT_OF_CREDITS_MESSAGE
            assert len(rendered.body) == 1
            assert isinstance(rendered.body[0], ParagraphSection)
            assert rendered.body[0].blocks[0].text == OUT_OF_CREDITS_MESSAGE


class SeerInvestigationStartedTemplateTest(TestCase):
    def test_render(self) -> None:
        rendered = SeerInvestigationStartedTemplate().render(
            SeerInvestigationStarted(
                organization_id=1,
                slack_user_id="U0123456789",
                investigation_url="https://example.sentry.io/seer/investigations/1/",
            )
        )

        assert rendered.subject == "Seer investigation started"
        assert isinstance(rendered.body[0], ParagraphSection)
        assert rendered.body[0].blocks[0].text == "Seer started an investigation for this alert."


class SeerInvestigationErrorTemplateTest(TestCase):
    def test_render(self) -> None:
        rendered = SeerInvestigationErrorTemplate().render(
            SeerInvestigationError(organization_id=1, error_message="Something broke")
        )

        assert rendered.subject == "Seer couldn't start an investigation"
        assert isinstance(rendered.body[0], ParagraphSection)
        assert rendered.body[0].blocks[0].text == "Something broke"


class SeerInvestigationStatusTemplateTest(TestCase):
    def test_render_example(self) -> None:
        template = SeerInvestigationStatusTemplate()

        rendered = template.render_example()

        assert rendered.subject == "Investigating FCP on organization login pages"
        assert len(rendered.body) == len(template.example_data.hypotheses)
        (action,) = rendered.actions
        assert action.label == "View full investigation"
        assert action.link == template.example_data.investigation_url


class SeerInvestigationConclusionTemplateTest(TestCase):
    def test_render_example(self) -> None:
        template = SeerInvestigationConclusionTemplate()

        rendered = template.render_example()

        assert rendered.subject == "Seer investigation conclusion"
        assert len(rendered.body) == 3
        (action,) = rendered.actions
        assert action.label == "View full investigation"
        assert action.link == template.example_data.investigation_url
