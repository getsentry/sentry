import io
import tarfile
from contextlib import contextmanager
from unittest import mock

import pytest

from sentry.integrations.perforce.api_client import PerforceApiClient, segment_print
from sentry.integrations.perforce.p4protocol import P4Exception
from sentry.utils import json

DEPOT = "//SentryDemo/main"


def _client(*results):
    """A PerforceClient whose _connect() yields a p4 returning `results` in order."""
    p4 = mock.Mock()
    p4.run.side_effect = list(results)

    @contextmanager
    def _connect():
        yield p4

    client = mock.Mock()
    client._connect = _connect
    client.get_author_info_from_cache.return_value = ("someone@example.com", "Some One")
    return PerforceApiClient(client), p4


def test_segment_print_splits_on_stat_records():
    """A file with no trailing newline runs straight into the next file's header, so
    content must be segmented on the stat dicts rather than parsed by line."""
    result = [
        {"depotFile": f"{DEPOT}/a.cpp"},
        b"no trailing newline",
        {"depotFile": f"{DEPOT}/b.cpp"},
        b"second",
        b" file",
    ]
    assert segment_print(result) == [
        ({"depotFile": f"{DEPOT}/a.cpp"}, b"no trailing newline"),
        ({"depotFile": f"{DEPOT}/b.cpp"}, b"second file"),
    ]


def test_segment_print_ignores_content_before_any_stat():
    assert segment_print([b"orphan", {"depotFile": "x"}, b"body"]) == [
        ({"depotFile": "x"}, b"body")
    ]


def test_unknown_route_is_a_404():
    client, _ = _client()
    assert client.request("GET", "/nope").status_code == 404


def test_p4_missing_file_maps_to_404():
    """The provider turns status into a coded error, so "no such file(s)" must not be a 500."""
    client, p4 = _client(P4Exception("//depot/x - no such file(s)."))
    p4.run.side_effect = P4Exception("//depot/x - no such file(s).")
    assert client.request("GET", "/print", params={"path": "//depot/x"}).status_code == 404


def test_changes_enriches_the_author():
    """``p4 changes`` reports only a login, but CommitAuthor.email is required downstream."""
    client, _ = _client([{"change": "2993", "user": "someone"}])
    payload = json.loads(client.request("GET", "/changes", params={"path": f"{DEPOT}/..."}).content)
    assert payload[0]["userEmail"] == "someone@example.com"
    assert payload[0]["userFullName"] == "Some One"


def test_changes_converts_the_date_window_to_p4_syntax():
    client, p4 = _client([])
    client.request(
        "GET",
        "/changes",
        params={"path": f"{DEPOT}/...", "since": "2026-01-01", "until": "2026-02-01"},
    )
    assert p4.run.call_args[0][-1] == f"{DEPOT}/...@2026/01/01,@2026/02/01"


def test_print_returns_base64_content():
    client, _ = _client([{"depotFile": f"{DEPOT}/a.cpp", "fileSize": "5"}, b"hello"])
    payload = json.loads(client.request("GET", "/print", params={"path": f"{DEPOT}/a.cpp"}).content)
    assert payload == {
        "stat": {"depotFile": f"{DEPOT}/a.cpp", "fileSize": "5"},
        "content_base64": "aGVsbG8=",
    }


def _archive_members(client):
    response = client.request("GET", "/archive", params={"path": f"{DEPOT}/...", "change": "2993"})
    body = b"".join(response.iter_content(chunk_size=8192))
    with tarfile.open(fileobj=io.BytesIO(body), mode="r:gz") as tar:
        extracted = ((member.name, tar.extractfile(member)) for member in tar.getmembers())
        return {name: handle.read() for name, handle in extracted if handle is not None}


def test_archive_puts_everything_under_one_top_level_directory():
    """Seer's extractor moves that directory's *contents* into place; entries at the
    tar root silently yield a wrong tree instead of an error."""
    manifest = [{"depotFile": f"{DEPOT}/Source/a.cpp", "headType": "text", "fileSize": "5"}]
    client, _ = _client(manifest, [{"depotFile": f"{DEPOT}/Source/a.cpp"}, b"hello"])

    members = _archive_members(client)
    assert members == {"SentryDemo-main-2993/Source/a.cpp": b"hello"}


@pytest.mark.parametrize(
    "record",
    [
        {"depotFile": f"{DEPOT}/art.uasset", "headType": "binary+FS2w", "fileSize": "10"},
        {"depotFile": f"{DEPOT}/huge.cpp", "headType": "text", "fileSize": str(2 * 1024 * 1024)},
        {
            "depotFile": f"{DEPOT}/gone.cpp",
            "headType": "text",
            "headAction": "delete",
            "fileSize": "5",
        },
    ],
    ids=["binary", "oversized", "deleted"],
)
def test_archive_excludes_unreadable_files(record):
    """Binary assets dominate a real depot by bytes, oversized files exceed Seer's own
    read cap, and a deleted revision has no content to print."""
    client, p4 = _client([record])
    assert _archive_members(client) == {}
    # Only the manifest call; nothing was printed.
    assert p4.run.call_count == 1


def test_archive_batches_prints():
    """One print per batch keeps peak memory proportional to a batch, not the depot."""
    manifest = [
        {"depotFile": f"{DEPOT}/f{i}.cpp", "headType": "text", "fileSize": "1"} for i in range(250)
    ]
    prints = [
        [x for i in range(200) for x in ({"depotFile": f"{DEPOT}/f{i}.cpp"}, b"a")],
        [x for i in range(200, 250) for x in ({"depotFile": f"{DEPOT}/f{i}.cpp"}, b"a")],
    ]
    client, p4 = _client(manifest, *prints)

    assert len(_archive_members(client)) == 250
    assert p4.run.call_count == 3  # 1 manifest + 2 print batches
