from unittest.mock import patch

from sentry.constants import ENABLE_SEER_CODING_DEFAULT
from sentry.notifications.platform.templates.seer import SeerAutofixUpdate
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.testutils.cases import TestCase


class SeerAutofixUpdateTest(TestCase):
    def _create_update(self, current_point: AutofixStoppingPoint) -> SeerAutofixUpdate:
        return SeerAutofixUpdate(
            run_id=123,
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.group.id,
            current_point=current_point,
            group_link="https://sentry.io/issues/123",
        )

    def test_next_point_root_cause(self):
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        assert update.next_point == AutofixStoppingPoint.SOLUTION

    def test_next_point_solution(self):
        update = self._create_update(AutofixStoppingPoint.SOLUTION)
        assert update.next_point == AutofixStoppingPoint.CODE_CHANGES

    def test_next_point_code_changes(self):
        update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert update.next_point == AutofixStoppingPoint.OPEN_PR

    def test_next_point_open_pr(self):
        update = self._create_update(AutofixStoppingPoint.OPEN_PR)
        assert update.next_point is None

    def test_has_next_trigger_root_cause(self):
        update = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        assert update.has_next_trigger is True

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_solution_coding_enabled(self, mock_get_option):
        mock_get_option.return_value = True
        update = self._create_update(AutofixStoppingPoint.SOLUTION)
        assert update.has_next_trigger is True
        mock_get_option.assert_called_once_with(
            organization_id=self.organization.id,
            key="sentry:enable_seer_coding",
        )

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_solution_coding_disabled(self, mock_get_option):
        mock_get_option.return_value = False
        update = self._create_update(AutofixStoppingPoint.SOLUTION)
        assert update.has_next_trigger is False

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_solution_coding_default(self, mock_get_option):
        mock_get_option.return_value = None
        update = self._create_update(AutofixStoppingPoint.SOLUTION)
        assert update.has_next_trigger is ENABLE_SEER_CODING_DEFAULT

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_code_changes_coding_enabled(self, mock_get_option):
        mock_get_option.return_value = True
        update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert update.has_next_trigger is True

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_code_changes_coding_disabled(self, mock_get_option):
        mock_get_option.return_value = False
        update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert update.has_next_trigger is False

    @patch("sentry.notifications.platform.templates.seer.organization_service.get_option")
    def test_has_next_trigger_code_changes_coding_default(self, mock_get_option):
        mock_get_option.return_value = None
        update = self._create_update(AutofixStoppingPoint.CODE_CHANGES)
        assert update.has_next_trigger is ENABLE_SEER_CODING_DEFAULT

    def test_has_next_trigger_open_pr(self):
        update = self._create_update(AutofixStoppingPoint.OPEN_PR)
        assert update.has_next_trigger is False
