from unittest.mock import Mock, patch

from django.db.models import F

from sentry.models.project import Project
from sentry.signals import BetterSignal
from sentry.testutils.cases import TestCase
from sentry.utils.projectflags import set_project_flag_and_signal

test_signal = BetterSignal()


class SetProjectFlagsAndSignalTest(TestCase):
    @patch.object(test_signal, "send_robust")
    def test_basic(self, mock_send_robust: Mock):
        assert not self.project.flags.has_transactions
        assert set_project_flag_and_signal(self.project, "has_transactions", test_signal) == 1
        mock_send_robust.assert_called_once_with(project=self.project, sender=Project)

        assert self.project.flags.has_transactions

    @patch.object(test_signal, "send_robust")
    def test_flag_already_set(self, mock_send_robust: Mock):
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        assert self.project.flags.has_transactions
        assert set_project_flag_and_signal(self.project, "has_transactions", test_signal) == 0
        mock_send_robust.assert_not_called()
        assert self.project.flags.has_transactions

    @patch.object(test_signal, "send_robust")
    def test_signal_kwargs(self, mock_send_robust: Mock):
        assert not self.project.flags.has_transactions
        assert (
            set_project_flag_and_signal(self.project, "has_transactions", test_signal, a=1, b="xyz")
            == 1
        )
        mock_send_robust.assert_called_once_with(project=self.project, sender=Project, a=1, b="xyz")

        assert self.project.flags.has_transactions
