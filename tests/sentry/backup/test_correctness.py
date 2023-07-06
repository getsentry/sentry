from __future__ import annotations

import os
from difflib import unified_diff
from pathlib import Path
from typing import NewType

from click.testing import CliRunner
from freezegun import freeze_time
from pydantic import FilePath, PositiveInt

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.runner.commands.backup import export, import_
from sentry.utils import json
from sentry.utils.json import JSONData, JSONEncoder, better_default_encoder
from sentry.utils.pytest.fixtures import django_db_all

ComparatorName = NewType("ComparatorName", str)
ModelName = NewType("ModelName", str)


# TODO(team-ospo/#155): Figure out if we are going to use `pk` as part of the identifier, or some other kind of sequence number internal to the JSON export instead.
class InstanceID:
    """Every entry in the generated backup JSON file should have a unique model+pk combination, which serves as its identifier."""

    def __init__(self, model: ModelName, pk: PositiveInt):
        self.model = model
        self.pk = pk

    def __eq__(self, other):
        return (
            hasattr(other, "model")
            and self.model == other.model
            and hasattr(other, "pk")
            and self.pk == other.pk
        )

    def __hash__(self):
        return hash((self.model, self.pk))

    def print(self):
        return f'InstanceID(model: "{self.model}", pk: {self.pk})'


class ComparatorFinding:
    """Store all information about a single failed matching between expected and actual output."""

    def __init__(self, name: ComparatorName, on: InstanceID, reason: str | None = ""):
        self.name = name
        self.on = on
        self.reason = reason

    def print(self):
        return f'Finding(\n\tname: "{self.name}",\n\ton: {self.on.print()},\n\treason: {self.reason}\n)'


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: list[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding):
        self.findings.append(finding)

    def assert_on_findings(self):
        if self.findings:
            assert False, self.print()

    def print(self):
        return "\n".join(map(lambda f: f.print(), self.findings))


REPO_PATH = Path(os.path.dirname(os.path.realpath("__file__")))
FIXTURE_PATH = REPO_PATH / "fixtures/backup"
INDENT = 2
JSON_PRETTY_PRINTER = JSONEncoder(
    default=better_default_encoder, indent=INDENT, ignore_nan=True, sort_keys=True
)


def json_lines(obj: JSONData) -> list[str]:
    """Take a JSONData object and pretty-print it as JSON."""

    return JSON_PRETTY_PRINTER.encode(obj).splitlines()


# TODO(team-ospo/#155): Move this out of the test suite, and into its own standalone module, since eventually it will be used to compare live JSON as well.
def validate(expect: JSONData, actual: JSONData) -> ComparatorFindings:
    """Ensures that originally imported data correctly matches actual outputted data, and produces a list of reasons why not when it doesn't"""

    findings = ComparatorFindings([])
    exp_models = {}
    act_models = {}
    for model in expect:
        id = InstanceID(ModelName(model["model"]), PositiveInt(model["pk"]))
        exp_models[id] = model

    # Ensure that the actual JSON contains no duplicates - we assume that the expected JSON did not.
    for model in actual:
        id = InstanceID(ModelName(model["model"]), PositiveInt(model["pk"]))
        if id in act_models:
            findings.append(ComparatorFinding(ComparatorName("duplicate_entry"), id))
        else:
            act_models[id] = model

    # Report unexpected and missing entries in the actual JSON.
    act_ids = list(act_models)
    exp_ids = list(exp_models)
    for id in act_ids:
        if id not in exp_ids:
            del act_models[id]
            findings.append(ComparatorFinding(ComparatorName("unexpected_entry"), id))
    for id in exp_ids:
        if id not in act_ids:
            del exp_models[id]
            findings.append(ComparatorFinding(ComparatorName("missing_entry"), id))

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for id, act in act_models.items():
        exp = exp_models[id]

        # Finally, perform a diff on the remaining JSON.
        diff = list(
            unified_diff(json_lines(exp["fields"]), json_lines(act["fields"]), n=3, lineterm="\n")
        )
        if diff:
            findings.append(
                ComparatorFinding(ComparatorName("json_diff"), id, "\n    " + "\n    ".join(diff))
            )

    findings.assert_on_findings()
    return findings


def import_then_export(
    tmp_path: FilePath, backup_json_file_path: FilePath
) -> tuple[JSONData, JSONData, ComparatorFindings]:
    """Test helper that validates that the originally imported data correctly matches actual
    outputted data, and produces a list of reasons why not when it doesn't"""

    with open(backup_json_file_path) as backup_file:
        input = json.loads(backup_file.read())

    with in_test_psql_role_override("postgres"):
        rv = CliRunner().invoke(import_, [str(backup_json_file_path)])
        assert rv.exit_code == 0, rv.output

    tmp_json_file_path = str(tmp_path.joinpath("tmp_test_file.json"))
    rv = CliRunner().invoke(
        export, [tmp_json_file_path], obj={"silent": True, "indent": INDENT, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(tmp_json_file_path) as tmp_file:
        output = json.loads(tmp_file.read())
    return input, output, validate(input, output)


@django_db_all
@freeze_time("2023-06-22T23:00:00.123Z")
def test_fresh_install(tmp_path):
    import_then_export(tmp_path, FIXTURE_PATH / "fresh-install.json")
