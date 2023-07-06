from __future__ import annotations

from difflib import unified_diff
from pathlib import Path
from typing import NamedTuple

import pytest
from click.testing import CliRunner
from freezegun import freeze_time

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.runner.commands.backup import export, import_
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.json import JSONData, JSONEncoder, better_default_encoder


# TODO(team-ospo/#155): Figure out if we are going to use `pk` as part of the identifier, or some other kind of sequence number internal to the JSON export instead.
class InstanceID(NamedTuple):
    """Every entry in the generated backup JSON file should have a unique model+pk combination, which serves as its identifier."""

    model: str
    pk: int

    def pretty(self) -> str:
        return f"InstanceID(model: {self.model!r}, pk: {self.pk})"


class ComparatorFinding(NamedTuple):
    """Store all information about a single failed matching between expected and actual output."""

    name: str
    on: InstanceID
    reason: str = ""

    def pretty(self) -> str:
        return f"Finding(\n\tname: {self.name!r},\n\ton: {self.on.pretty()},\n\treason: {self.reason}\n)"


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: list[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding) -> None:
        self.findings.append(finding)

    def pretty(self) -> str:
        return "\n".join(f.pretty() for f in self.findings)


JSON_PRETTY_PRINTER = JSONEncoder(
    default=better_default_encoder, indent=2, ignore_nan=True, sort_keys=True
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
        id = InstanceID(model["model"], model["pk"])
        exp_models[id] = model

    # Ensure that the actual JSON contains no duplicates - we assume that the expected JSON did not.
    for model in actual:
        id = InstanceID(model["model"], model["pk"])
        if id in act_models:
            findings.append(ComparatorFinding("duplicate_entry", id))
        else:
            act_models[id] = model

    # Report unexpected and missing entries in the actual JSON.
    extra = sorted(act_models.keys() - exp_models.keys())
    missing = sorted(exp_models.keys() - act_models.keys())
    for id in extra:
        del act_models[id]
        findings.append(ComparatorFinding("unexpected_entry", id))
    for id in missing:
        del exp_models[id]
        findings.append(ComparatorFinding("missing_entry", id))

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for id, act in act_models.items():
        exp = exp_models[id]

        # Finally, perform a diff on the remaining JSON.
        diff = list(unified_diff(json_lines(exp["fields"]), json_lines(act["fields"]), n=3))
        if diff:
            findings.append(ComparatorFinding("json_diff", id, "\n    " + "\n    ".join(diff)))

    return findings


def import_then_export(tmp_path: Path, fixture_file_name: str) -> None:
    """Test helper that validates that the originally imported data correctly matches actual
    outputted data, and produces a list of reasons why not when it doesn't"""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        input = json.load(backup_file)

    with in_test_psql_role_override("postgres"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    tmp_json_file_path = str(tmp_path.joinpath("tmp_test_file.json"))
    rv = CliRunner().invoke(
        export, [tmp_json_file_path], obj={"silent": True, "indent": 2, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(tmp_json_file_path) as tmp_file:
        output = json.load(tmp_file)

    res = validate(input, output)
    if res.findings:
        raise AssertionError(res.pretty())


@pytest.mark.django_db(transaction=True, reset_sequences=True, databases="__all__")
@freeze_time("2023-06-22T23:00:00.123Z")
def test_fresh_install(tmp_path):
    import_then_export(tmp_path, "fresh-install.json")
