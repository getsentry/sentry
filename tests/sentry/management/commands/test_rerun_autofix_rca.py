from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from sentry.testutils.cases import TestCase


class RerunAutofixRcaCommandTest(TestCase):
    def test_validates_then_queues_deduplicated_run_ids(self) -> None:
        with TemporaryDirectory() as directory:
            input_path = Path(directory) / "affected.csv"
            input_path.write_text("run_id\n1\n2\n1\n")

            with patch(
                "sentry.management.commands.rerun_autofix_rca.rerun_autofix_rca_batch.delay"
            ) as mock_delay:
                call_command("rerun_autofix_rca", input=str(input_path))
                mock_delay.assert_not_called()

                call_command("rerun_autofix_rca", input=str(input_path), execute=True)

        mock_delay.assert_called_once_with([1, 2])

    def test_requires_run_id_column(self) -> None:
        with TemporaryDirectory() as directory:
            input_path = Path(directory) / "affected.csv"
            input_path.write_text("group_id\n1\n")

            with pytest.raises(CommandError, match="run_id"):
                call_command("rerun_autofix_rca", input=str(input_path))
