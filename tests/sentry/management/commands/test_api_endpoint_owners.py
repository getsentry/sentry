from io import StringIO
from pathlib import Path
from typing import Any

from django.core.management import call_command

from sentry.api.endpoint_owners import build_owner_map
from sentry.utils import json


def run_command(**kwargs: str) -> str:
    out = StringIO()
    call_command("api_endpoint_owners", stdout=out, stderr=StringIO(), **kwargs)
    return out.getvalue()


# every row from build_owner_map is in the {path: {class_name: owner}} map, and nothing else is,
# so these tests don't depend on which team owns which endpoint
def assert_matches_owner_map(owner_map: dict[str, Any]) -> None:
    rows = build_owner_map()
    for row in rows:
        assert owner_map[row.path][row.class_name] == row.owner

    class_count = 0
    for classes in owner_map.values():
        class_count += len(classes)
    assert class_count == len(rows)


# with no --output the map is printed as {path: {class_name: owner}}
def test_prints_the_owner_map_as_json() -> None:
    owner_map = json.loads(run_command())

    assert_matches_owner_map(owner_map)


# with --output the map is written to that file and only a short message is printed
def test_writes_the_owner_map_to_output(tmp_path: Path) -> None:
    output = tmp_path / "owners.json"

    message = run_command(output=str(output))

    assert_matches_owner_map(json.loads(output.read_text()))
    assert message.startswith("Wrote ")
