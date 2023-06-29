import io
import os
from pathlib import Path
from typing import Dict, List, NewType, Optional, Protocol, Tuple

from dateutil import parser
from django.db import IntegrityError
from jsondiff import diff
from pydantic import FilePath, PositiveInt

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.runner.commands.backup import exporter, importer
from sentry.utils import json
from sentry.utils.json import JSONData
from sentry.utils.pytest.fixtures import django_db_all

ComparatorName = NewType("ComparatorName", str)
ModelName = NewType("ModelName", str)


class InstanceID:
    """Every entry in the generated backup JSON file should have a unique model+pk combination, which serves as its identifier."""

    model: ModelName
    pk: PositiveInt

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

    def __str__(self):
        return f'InstanceID(model: "{self.model}", pk: {self.pk})'


class ComparatorFinding:
    """Store all information about a single failed matching between expected and actual output."""

    name: ComparatorName
    on: InstanceID
    reason: str

    def __init__(self, name: ComparatorName, on: InstanceID, reason: Optional[str] = ""):
        self.name = name
        self.on = on
        self.reason = reason

    def __str__(self):
        return (
            f'Finding(\n\tname: "{self.name}",\n\ton: {str(self.on)},\n\treason: {self.reason}\n)'
        )


class ComparatorFindings(List[ComparatorFinding]):
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __str__(self):
        out = ""
        for finding in self:
            out += "\n" + str(finding)
        return out

    def maybe_assert(self):
        if len(self) > 0:
            assert False, str(self)


class JSONMutatingComparator(Protocol):
    """A callback protocol specifying the function signature for custom JSON comparators."""

    def __call__(self, on: InstanceID, expect: JSONData, actual: JSONData) -> Optional[str]:
        ...


def comparator_date_updated(on, expect, actual):
    exp_date_updated = parser.parse(expect["fields"]["date_updated"])
    act_date_updated = parser.parse(actual["fields"]["date_updated"])
    if not act_date_updated >= exp_date_updated:
        return f"{expect['fields']['date_updated']} was not >= {actual['fields']['date_updated']}"
    else:
        expect["fields"]["date_updated"] = "__COMPARATOR_DATE_UPDATED__"
        actual["fields"]["date_updated"] = "__COMPARATOR_DATE_UPDATED__"


REPO_PATH = Path(os.path.dirname(os.path.realpath("__file__")))
SNAPSHOT_PATH = REPO_PATH / "tests/sentry/backup/snapshots"
EXPORT_INDENTATION = 2
COMPARATORS: Dict[Optional[ModelName], List[JSONMutatingComparator]] = {
    None: [],
    ModelName("sentry.userrole"): [comparator_date_updated],
    ModelName("sentry.userroleuser"): [comparator_date_updated],
}


def validate(expect: JSONData, actual: JSONData) -> ComparatorFindings:
    """Ensures that originally imported data correctly matches actual outputted data, and produces a list of reasons why not when it doesn't"""

    findings: ComparatorFindings = ComparatorFindings()
    exp_models: Dict[InstanceID, JSONData] = {}
    act_models: Dict[InstanceID, JSONData] = {}
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

        # Try global comparators and comparators applicable for this specific model.
        for cmp in COMPARATORS[None]:
            res = cmp(id, exp, act)
            if res:
                findings.append(ComparatorFinding(ComparatorName(cmp.__name__), id, res))
        if id.model in COMPARATORS:
            for cmp in COMPARATORS[id.model]:
                res = cmp(id, exp, act)
                if res:
                    findings.append(ComparatorFinding(ComparatorName(cmp.__name__), id, res))

        # Finally, perform a diff on the remaining JSON.
        json_diff = diff(exp["fields"], act["fields"], syntax="explicit", marshal=True)
        if json_diff:
            findings.append(
                ComparatorFinding(ComparatorName("json_diff"), id, json.dumps(json_diff))
            )

    findings.maybe_assert()
    return findings


def import_then_export(
    backup_json_file_path: FilePath, silent: bool = True
) -> Tuple[JSONData, JSONData, ComparatorFindings]:
    """Test helper that originally imported data correctly matches actual outputted data, and
    produces a list of reasons why not when it doesn't"""

    with open(backup_json_file_path) as backup_file:
        contents = backup_file.read()
        instream = io.StringIO(contents)
        input = json.load(instream)
        with in_test_psql_role_override("postgres"):
            try:
                instream.seek(0)
                importer(instream)
            except IntegrityError as e:
                assert False, f"Raised an exception {e}"

    outstream = io.StringIO()
    exporter(outstream, silent, indent=EXPORT_INDENTATION, exclude=None)
    outstream.seek(0)
    output = json.load(outstream)
    return input, output, validate(input, output)


@django_db_all
def test_fresh_install():
    import_then_export(SNAPSHOT_PATH / "fresh_install.json")
