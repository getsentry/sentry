from __future__ import annotations

from pathlib import Path

from click.testing import CliRunner

from sentry.runner.commands.backup import ComparatorFindings, export
from sentry.utils import json


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def tmp_export_to_file(tmp_path: Path) -> json.JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    tmp_json_file_path = str(tmp_path)
    rv = CliRunner().invoke(
        export, [tmp_json_file_path], obj={"silent": True, "indent": 2, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(tmp_json_file_path) as tmp_file:
        output = json.load(tmp_file)
    return output
