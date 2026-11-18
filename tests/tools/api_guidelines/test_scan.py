from __future__ import annotations

from pathlib import Path
from unittest import mock

from tools.api_guidelines import scan
from tools.api_guidelines.rules import ApiRule
from tools.api_guidelines.scan import collect_findings
from tools.flake8_plugin import ApiInputViolation

PATH = "src/sentry/api/endpoints/example.py"

# this example endpoint has 4 findings: lines 5 and 6 read the same key in the same method, and
# _build is a helper reached from both get and put but reported once only at the helper
EXAMPLE_ENDPOINT = """\
class ExampleEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "PUT": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET.get("id") # line 5
        b = request.GET.get("id") # line 6
        return _build(request)

    def put(self, request) -> Response[X]:
        name = request.data.get("name")
        return _build(request)


def _build(request):
    return request.GET.get("cursor")
"""


def _write_example(root: Path) -> None:
    """Writes the example endpoint into a fake repo at `root`"""
    endpoint = root / PATH
    endpoint.parent.mkdir(parents=True)
    endpoint.write_text(EXAMPLE_ENDPOINT)


def _violation(rule: str, key: str) -> ApiInputViolation:
    """A finding made by hand, without scanning any code"""
    return ApiInputViolation(
        rule=ApiRule(rule),
        message="m",
        line=1,
        column=0,
        end_line=1,
        end_column=1,
        severity="warning",
        scope="ExampleEndpoint.get",
        key=key,
        caller=None,
    )


def test_collect_findings_scans_only_src_with_repo_relative_paths(tmp_path: Path) -> None:
    _write_example(tmp_path)
    # same code outside src/ isn't scanned
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "example.py").write_text(EXAMPLE_ENDPOINT)

    findings = collect_findings(tmp_path)

    paths = set()
    for path, _finding in findings:
        paths.add(path)

    assert len(findings) == 4
    assert paths == {PATH}


def test_collect_findings_returns_every_rules_findings(tmp_path: Path) -> None:
    _write_example(tmp_path)
    # no real file gives a structured S034 finding today, so the plugin's output is faked. The
    # scan keeps both, since picking rules is up to each caller (the baseline, the report card)
    s026 = _violation("S026", "query:id")
    s034 = _violation("S034", "status:404")

    with mock.patch.object(scan, "get_api_violations", return_value=[s026, s034]):
        findings = collect_findings(tmp_path)

    assert findings == [(PATH, s026), (PATH, s034)]
