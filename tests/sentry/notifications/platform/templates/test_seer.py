from unittest.mock import Mock, patch

import pytest

from fixtures.seer.webhooks import MOCK_GROUP_ID, MOCK_RUN_ID
from sentry.constants import ENABLE_SEER_CODING_DEFAULT
from sentry.notifications.platform.templates.seer import (
    SeerAutofixTrigger,
    SeerAutofixUpdate,
    _get_next_stopping_point,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
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

    def test_next_point(self) -> None:
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        assert update.next_point == AutofixStoppingPoint.SOLUTION

        update = self._create_update(AutofixStoppingPoint.SOLUTION)
        assert update.next_point == AutofixStoppingPoint.CODE_CHANGES

        update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert update.next_point == AutofixStoppingPoint.OPEN_PR

        update = self._create_update(AutofixStoppingPoint.OPEN_PR)
        assert update.next_point is None

    def test_has_next_trigger_simple(self) -> None:
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        assert update.has_next_trigger is True
        update = self._create_update(AutofixStoppingPoint.OPEN_PR)
        assert update.has_next_trigger is False

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
