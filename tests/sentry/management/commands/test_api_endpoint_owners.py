from io import StringIO
from pathlib import Path

from django.core.management import call_command

from sentry.utils import json

REPLAY_DETAILS_PATH = "src/sentry/replays/endpoints/organization_replay_details.py"


def run_command(**kwargs: str) -> str:
    out = StringIO()
    call_command("api_endpoint_owners", stdout=out, stderr=StringIO(), **kwargs)
    return out.getvalue()


# with no --output the map is printed as {path: {class_name: owner}}
def test_prints_the_owner_map_as_json() -> None:
    owner_map = json.loads(run_command())

    assert owner_map[REPLAY_DETAILS_PATH]["OrganizationReplayDetailsEndpoint"] == "data-browsing"


# with --output the map is written to that file and only a short message is printed
def test_writes_the_owner_map_to_output(tmp_path: Path) -> None:
    output = tmp_path / "owners.json"

    message = run_command(output=str(output))

    owner_map = json.loads(output.read_text())
    assert owner_map[REPLAY_DETAILS_PATH]["OrganizationReplayDetailsEndpoint"] == "data-browsing"
    assert message.startswith("Wrote ")
