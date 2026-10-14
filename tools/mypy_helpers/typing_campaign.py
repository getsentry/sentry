from __future__ import annotations

import argparse
import ast
import hashlib
import io
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import time
import tokenize
import tomllib
import traceback
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import asdict, dataclass, field, replace
from enum import IntEnum, StrEnum
from pathlib import Path, PurePosixPath
from typing import Callable

from tools.mypy_helpers.config_sections import (
    InvalidMarkedSection,
    clear_marked_section,
    marked_section,
)
from tools.mypy_helpers.mypy_config import InvalidMypyConfig, relocate_path_options
from tools.mypy_helpers.mypy_output import (
    InvalidMypyOutput,
    parse_diagnostic_line,
    parse_mypy_output,
)

EXPECTED_MYPY_VERSION = "2.1.0"
ERROR_SECTION = "sentry modules with typing issues"
WEAK_SECTION = "not yet strongly typed"
WEAK_OPTIONS = ("disallow_any_generics", "disallow_untyped_defs", "strict_equality")
FIRST_PARTY_ROOTS = frozenset({"sentry", "tests", "fixtures", "tools"})
REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIGURED = "configured"
STANDALONE_SOURCE_BATCH_SIZE = 8


class ExitCode(IntEnum):
    COMPLETE = 0
    REJECTED = 1
    INVALID = 2


class Outcome(StrEnum):
    COMPLETE = "complete"
    REJECTED = "rejected"
    INVALID = "invalid"


class Profile(StrEnum):
    CONFIGURED = "configured"
    UNSUPPRESSED = "unsuppressed"
    ALL_STRONG = "all-strong"
    PRECISION = "precision"


class SourceKind(StrEnum):
    OWNED_IMPLEMENTATION = "owned-implementation"
    OWNED_STUB = "owned-stub"
    OWNED_GENERATED = "owned-generated-implementation"
    VENDORED = "vendored-implementation"
    NON_IMPORTABLE = "non-importable-executable"


@dataclass(frozen=True)
class SourceFile:
    path: str
    module: str | None
    kind: SourceKind


@dataclass(frozen=True)
class DiagnosticRecord:
    path: str
    code: str | None
    message: str

    @property
    def key(self) -> tuple[str, str | None, str]:
        return self.path, self.code, self.message


@dataclass(frozen=True)
class ModuleState:
    module: str
    path: str
    checked: bool
    ast_retained: bool
    is_stub: bool
    weak_options: tuple[str, ...]
    disabled_codes: tuple[str, ...]
    follow_imports: str
    follow_imports_for_stubs: str
    effective_options: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class AnyObligation:
    path: str
    anchor: str
    type_position: str
    origin: str
    exception: str | None = None

    @property
    def key(self) -> tuple[str, str, str, str, str]:
        return self.path, self.anchor, self.type_position, self.origin, self.exception or ""


@dataclass(frozen=True)
class ProfileMeasurement:
    profile: Profile
    tree: str
    checker_status: int
    source_count: int
    diagnostics: tuple[DiagnosticRecord, ...]
    graph: tuple[ModuleState, ...]
    any_obligations: tuple[AnyObligation, ...]
    environment_warnings: tuple[str, ...]
    elapsed_seconds: float
    peak_rss_bytes: int | None
    output_dir: Path
    adapter_status: int = 0
    adapter_stderr: str = ""
    checker_stderr: str = ""
    unanchored_any_count: int = 0
    reused_from_tree: str | None = None
    reuse_reason: str | None = None


@dataclass(frozen=True)
class TreeMeasurement:
    revision: str
    tree: str
    root: Path
    inventory: tuple[SourceFile, ...]
    profiles: Mapping[Profile, ProfileMeasurement]
    gaps: tuple[str, ...]
    precision_gaps: tuple[str, ...]
    weak_pairs: frozenset[tuple[str, str]]
    suppressed_pairs: frozenset[tuple[str, str]]
    bypasses: frozenset[tuple[str, str]]
    signatures: Mapping[tuple[str, str, str], str]
    signature_omissions: frozenset[tuple[str, str, str]]
    any_obligations: frozenset[AnyObligation]
    coverage: frozenset[str]
    source_digests: Mapping[str, str]
    source_contracts_reused_from_tree: str | None = None


@dataclass(frozen=True)
class Decision:
    outcome: Outcome
    reasons: tuple[str, ...]
    adoption_credit: bool
    core_complete: bool
    precision_complete: bool
    details: Mapping[str, object] = field(default_factory=dict)


class InvalidMeasurement(ValueError):
    def __init__(self, message: str, *, details: Mapping[str, object] | None = None) -> None:
        super().__init__(message)
        self.details = dict(details or {})


_WORKER = r'''from __future__ import annotations

import contextlib
import ast
from collections import Counter
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import resource
import sys
import traceback

import mypy.build
import mypy.main
import mypy.version
from mypy.nodes import Expression, Node
from mypy.types import AnyType, TypeOfAny, TypeQuery


def _rss_bytes() -> int:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if sys.platform == "darwin" else value * 1024)


class _AnyCollector(TypeQuery):
    def strategy(self, children):
        return [
            (item, (index, *position))
            for index, child in enumerate(children)
            for item, position in child
        ]

    def visit_any(self, typ):
        return [(typ, ())]


def _expressions(root) -> list[Expression]:
    ignored_attributes = {
        "alias_deps",
        "future_import_flags",
        "ignored_lines",
        "info",
        "manager",
        "module_refs",
        "names",
        "node",
        "options",
        "path",
        "plugin_deps",
        "raw_data",
        "skipped_lines",
        "type",
    }
    found = []
    seen = set()
    pending = [root]
    while pending:
        node = pending.pop()
        if id(node) in seen:
            continue
        seen.add(id(node))
        if isinstance(node, Expression):
            found.append(node)
        if isinstance(node, Node):
            attributes = []
            for cls in reversed(type(node).__mro__):
                attributes.extend(getattr(cls, "__mypyc_attrs__", ()))
            for attribute in dict.fromkeys(attributes):
                if attribute in ignored_attributes or attribute.startswith("_"):
                    continue
                value = getattr(node, attribute, None)
                if isinstance(value, Node):
                    pending.append(value)
                elif isinstance(value, dict):
                    pending.extend(value.values())
                elif isinstance(value, (list, tuple, set, frozenset)):
                    pending.extend(value)
    return found


def _origin_names() -> dict[int, str]:
    return {
        int(getattr(TypeOfAny, name)): name
        for name in (
            "explicit",
            "unannotated",
            "from_unimported_type",
            "from_omitted_generics",
            "from_error",
            "special_form",
            "from_another_any",
            "implementation_artifact",
            "suggestion_engine",
        )
        if getattr(TypeOfAny, name, None) is not None
    }


def _module_origin(name: str) -> str | None:
    spec = importlib.util.find_spec(name)
    if spec is None:
        return None
    return spec.origin or next(iter(spec.submodule_search_locations or ()), None)


def _states(result, target_modules: set[str], base_options) -> list[dict[str, object]]:
    states = []
    for module, state in sorted(result.graph.items()):
        options = state.options
        disabled = getattr(options, "disable_error_code", ())
        weak_options = []
        weak_when_false = (
            "check_untyped_defs",
            "disallow_any_decorated",
            "disallow_any_explicit",
            "disallow_any_expr",
            "disallow_any_generics",
            "disallow_any_unimported",
            "disallow_subclassing_any",
            "disallow_untyped_calls",
            "disallow_untyped_decorators",
            "disallow_untyped_defs",
            "local_partial_types",
            "follow_untyped_imports",
            "strict_equality",
            "strict_equality_for_none",
            "strict_optional",
            "warn_incomplete_stub",
            "warn_no_return",
            "warn_redundant_casts",
            "warn_return_any",
            "warn_unreachable",
            "warn_unused_configs",
            "warn_unused_ignores",
        )
        for name in weak_when_false:
            base_value = getattr(base_options, name, False)
            value = getattr(options, name, False)
            if (name in {"check_untyped_defs", "disallow_any_generics", "disallow_untyped_defs", "strict_equality"} and not value) or (base_value and not value):
                weak_options.append(f"{name}=false")
        weak_when_true = (
            "allow_empty_bodies",
            "allow_redefinition",
            "allow_redefinition_old",
            "allow_untyped_globals",
            "ignore_errors",
            "ignore_missing_imports",
            "implicit_optional",
            "implicit_reexport",
        )
        for name in weak_when_true:
            base_value = getattr(base_options, name, False)
            value = getattr(options, name, False)
            if value:
                weak_options.append(f"{name}=true")
        if options.follow_imports == "skip":
            weak_options.append("follow_imports=skip")
            if state.tree is not None and state.tree.is_stub and options.follow_imports_for_stubs:
                weak_options.append("follow_imports_for_stubs=true")
        states.append(
            {
                "module": module,
                "path": os.path.realpath(state.path) if state.path else "",
                "checked": bool(
                    state.tree is not None
                    and (
                        module in target_modules
                        or (
                            options.follow_imports != "skip"
                            and not (
                                state.tree.is_stub
                                and options.follow_imports_for_stubs
                            )
                        )
                    )
                ),
                "ast_retained": state.tree is not None,
                "is_stub": bool(state.tree and state.tree.is_stub),
                "weak_options": sorted(weak_options),
                "disabled_codes": sorted(str(item) for item in disabled),
                "follow_imports": str(options.follow_imports),
                "follow_imports_for_stubs": str(options.follow_imports_for_stubs),
                "effective_options": {
                    name: getattr(options, name, None)
                    for name in (
                        *weak_when_false,
                        *weak_when_true,
                        "follow_imports",
                        "follow_imports_for_stubs",
                    )
                },
            }
        )
    return states


def _ast_expression_anchors(path: str) -> tuple[dict[tuple[int, int, str], str], dict[str, str]]:
    with open(path, encoding="utf-8") as source_file:
        tree = ast.parse(source_file.read(), filename=path)
    expected_nodes = {
        "NameExpr": "Name",
        "MemberExpr": "Attribute",
        "CallExpr": "Call",
        "IndexExpr": "Subscript",
        "OpExpr": "BinOp",
        "ComparisonExpr": "Compare",
        "TupleExpr": "Tuple",
        "ListExpr": "List",
        "DictExpr": "Dict",
        "SetExpr": "Set",
        "GeneratorExpr": "GeneratorExp",
        "ListComprehension": "ListComp",
        "SetComprehension": "SetComp",
        "DictionaryComprehension": "DictComp",
        "IntExpr": "Constant",
        "FloatExpr": "Constant",
        "StrExpr": "Constant",
        "BytesExpr": "Constant",
        "EllipsisExpr": "Constant",
        "UnaryExpr": "UnaryOp",
        "ConditionalExpr": "IfExp",
        "LambdaExpr": "Lambda",
        "SliceExpr": "Slice",
        "StarExpr": "Starred",
    }
    counts: Counter[str] = Counter()
    anchors: dict[tuple[int, int, str], str] = {}
    nodes = sorted(
        (node for node in ast.walk(tree) if isinstance(node, ast.expr)),
        key=lambda node: (
            node.lineno,
            node.col_offset,
            node.end_lineno or node.lineno,
            node.end_col_offset or node.col_offset,
        ),
    )
    for node in nodes:
        fingerprint = hashlib.sha256(ast.dump(node, include_attributes=False).encode()).hexdigest()[:20]
        occurrence = counts[fingerprint]
        counts[fingerprint] += 1
        anchor = f"ast:{fingerprint}#{occurrence}"
        anchors[(node.lineno, node.col_offset, type(node).__name__)] = anchor
        anchors[(node.lineno, node.col_offset + 1, type(node).__name__)] = anchor
    return anchors, expected_nodes


def _any_obligations(result, origins: dict[int, str]) -> dict[str, object]:
    collector = _AnyCollector()
    found = set()
    unanchored_count = 0
    source_root = Path(os.environ["TYPING_CAMPAIGN_SOURCE_ROOT"]).resolve()
    for module, state in result.graph.items():
        if state.tree is None or not state.path:
            continue
        try:
            Path(state.path).resolve().relative_to(source_root)
        except ValueError:
            continue
        anchors, expected_nodes = _ast_expression_anchors(state.path)
        for expression in _expressions(state.tree):
            typ = result.types.get(expression)
            if typ is None:
                continue
            for any_type, type_path in collector.query_types([typ]):
                expression_kind = type(expression).__name__
                expected_kind = expected_nodes.get(expression_kind)
                anchor = anchors.get((expression.line, expression.column, expected_kind or ""))
                if anchor is None and expected_kind is not None:
                    anchor = anchors.get((expression.line, expression.column - 1, expected_kind))
                if anchor is None:
                    unanchored_count += 1
                    anchor = f"unanchored:{expression_kind}:{getattr(expression, 'name', '')}"
                origin = origins.get(int(any_type.type_of_any), f"unknown-{any_type.type_of_any}")
                position = "expression:" + ".".join(str(index) for index in type_path)
                found.add((os.path.realpath(state.path), anchor, position, origin))
    return {
        "obligations": [
            {"path": path, "anchor": anchor, "type_position": position, "origin": origin}
            for path, anchor, position, origin in sorted(found)
        ],
        "unanchored_count": unanchored_count,
    }


def main() -> int:
    output = io.StringIO()
    error_output = io.StringIO()
    try:
        if mypy.version.__version__ != os.environ["TYPING_CAMPAIGN_MYPY_VERSION"]:
            raise RuntimeError(f"unsupported mypy version {mypy.version.__version__}")
        args = sys.argv[1:]
        source_list = os.environ.get("TYPING_CAMPAIGN_SOURCE_LIST")
        if source_list:
            with open(source_list) as source_file:
                args.extend(json.load(source_file))
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(error_output):
            sources, options = mypy.main.process_options(args, require_targets=True)
            options.preserve_asts = True
            options.export_types = os.environ.get("TYPING_CAMPAIGN_PRECISION") == "1"
            options.hide_error_codes = False
            options.incremental = False
            options.num_workers = 0
            result = mypy.build.build(sources, options, stdout=output, stderr=error_output)
        errors = list(result.errors)
        target_modules = {source.module for source in sources}
        response = {
            "adapter_status": 0,
            "mypy_version": mypy.version.__version__,
            "checker_status": 1 if errors else 0,
            "source_count": len(sources),
            "targets": [
                {
                    "module": source.module,
                    "path": os.path.realpath(source.path) if source.path else "",
                }
                for source in sources
            ],
            "diagnostics": errors,
            "graph": _states(result, target_modules, options),
            "any_obligations": _any_obligations(result, _origin_names()) if options.export_types else {"obligations": [], "unanchored_count": 0},
            "stdout": output.getvalue(),
            "stderr": error_output.getvalue(),
            "peak_rss_bytes": _rss_bytes(),
            "origins": {name: _module_origin(name) for name in ("sentry", "tools")},
            "loaded_origins": {
                name: os.path.realpath(module.__file__)
                for name, module in sorted(sys.modules.items())
                if name.split(".", 1)[0] in {"sentry", "tests", "fixtures", "tools"}
                and getattr(module, "__file__", None)
            },
        }
        print(json.dumps(response, separators=(",", ":")))
        return 0
    except Exception as exc:
        response = {
            "adapter_status": 2,
            "error": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc(),
            "stdout": output.getvalue(),
            "stderr": error_output.getvalue(),
            "peak_rss_bytes": _rss_bytes(),
        }
        print(json.dumps(response, separators=(",", ":")))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


_DIAGNOSTIC_PATH = re.compile(r"^(?P<path>.+?\.pyi?):(?:(?:\d+):)?")
_UNKNOWN_OPTION_WARNING = re.compile(r"^\* Unknown config option found: '[^']+'$")
_NO_TYPE_CHECK_ATTRIBUTE = "no" + "_type_check"
_SDK_WARNING = re.compile(
    r"^.*/src/sentry/utils/sdk\.py:\d+: Warning: Sentry SDK not initialized: no DSN available\. "
    r"Set `backend_dsn` in SENTRY_SDK_CONFIG or ensure an internal project key exists\.$"
)


def profile_config(source: str, profile: Profile, source_root: Path) -> str:
    sections: tuple[str, ...]
    sections = {
        Profile.CONFIGURED: (),
        Profile.UNSUPPRESSED: (ERROR_SECTION,),
        Profile.ALL_STRONG: (ERROR_SECTION, WEAK_SECTION),
        Profile.PRECISION: (ERROR_SECTION, WEAK_SECTION),
    }[profile]
    try:
        derived = source
        for section in sections:
            derived = clear_marked_section(derived, section)
        derived = relocate_path_options(derived, source_root)
    except (InvalidMarkedSection, InvalidMypyConfig) as exc:
        raise InvalidMeasurement(f"{profile.value} profile cannot derive configuration: {exc}") from exc
    try:
        parsed = tomllib.loads(derived)
    except tomllib.TOMLDecodeError as exc:
        raise InvalidMeasurement(f"{profile.value} profile is invalid TOML: {exc}") from exc
    if not isinstance(parsed.get("tool", {}).get("mypy"), dict):
        raise InvalidMeasurement("derived profile has no [tool.mypy] table")
    if profile in (Profile.ALL_STRONG, Profile.PRECISION):
        remaining = parsed["tool"]["mypy"].get("overrides", [])
        if any(
            isinstance(override, dict)
            and ("disallow_untyped_defs" in override or "disable_error_code" in override)
            for override in remaining
        ):
            raise InvalidMeasurement("all-strong derivation left a migration override")
    return derived


def module_identity(path: str) -> str | None:
    parts = list(PurePosixPath(path).parts)
    if parts[:1] == ["src"]:
        parts.pop(0)
    elif parts[:2] == ["fixtures", "stubs-for-mypy"]:
        del parts[:2]
    if parts and parts[-1].endswith((".py", ".pyi")):
        parts[-1] = parts[-1].rsplit(".", 1)[0]
    if parts and parts[-1] == "__init__":
        parts.pop()
    if not parts or any(not part.isidentifier() for part in parts):
        return None
    return ".".join(parts)


def classify_source(path: str, header: str = "") -> SourceFile:
    if path.endswith(".pyi"):
        kind = SourceKind.OWNED_STUB
    elif path.startswith("bin/") or path.startswith("self-hosted/") or header.startswith("#!"):
        kind = SourceKind.NON_IMPORTABLE
    elif any(marker in header.lower() for marker in ("generated by", "auto-generated", "@generated")):
        kind = SourceKind.OWNED_GENERATED
    else:
        kind = SourceKind.OWNED_IMPLEMENTATION
    return SourceFile(path, module_identity(path), kind)


def _source_record(path: str, root: Path) -> SourceFile:
    with (root / path).open(encoding="utf-8", errors="replace") as source_file:
        header = "".join(source_file.readline() for _ in range(8))
    return classify_source(path, header)


def compare_error_debt(
    parent: Iterable[DiagnosticRecord], candidate: Iterable[DiagnosticRecord]
) -> tuple[DiagnosticRecord, ...]:
    parent_counts = Counter(item.key for item in parent)
    candidate_counts = Counter(item.key for item in candidate)
    additions = candidate_counts - parent_counts
    by_key = {item.key: item for item in candidate}
    return tuple(
        by_key[key]
        for key in sorted(additions.elements(), key=_diagnostic_sort_key)
    )


def _diagnostic_sort_key(key: tuple[str, str | None, str]) -> tuple[str, str, str]:
    path, code, message = key
    return path, code or "", message


def compare_obligations[T](
    parent: Iterable[T], candidate: Iterable[T], key: Callable[[T], object]
) -> tuple[T, ...]:
    parent_keys = {key(item) for item in parent}
    return tuple(item for item in candidate if key(item) not in parent_keys)


def _assert_tree_path(path: str, root: Path, *, owned_module: bool = False) -> str:
    if not path:
        raise InvalidMeasurement("mypy graph contains a source without a path")
    source_path = Path(path)
    resolved = (source_path if source_path.is_absolute() else root / source_path).resolve()
    try:
        return resolved.relative_to(root.resolve()).as_posix()
    except ValueError:
        if owned_module:
            raise InvalidMeasurement(f"first-party source resolved outside candidate snapshot: {path}")
        return resolved.as_posix()


def _diagnostic_record(value: str, root: Path) -> DiagnosticRecord:
    diagnostic = parse_diagnostic_line(value)
    if diagnostic is None or diagnostic.severity != "error" or diagnostic.filename is None:
        raise InvalidMeasurement(f"mypy API returned an unrecognized diagnostic: {value}")
    source_path = _assert_tree_path(diagnostic.filename, root)
    return DiagnosticRecord(source_path, diagnostic.code, diagnostic.message)


def _known_environment_warnings(output: str) -> tuple[str, ...]:
    lines = output.splitlines()
    warnings: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if _UNKNOWN_OPTION_WARNING.fullmatch(line):
            warnings.append(line)
            index += 1
            continue
        if _SDK_WARNING.fullmatch(line):
            if index + 1 >= len(lines) or lines[index + 1] not in {
                "  warnings.warn(",
                "  warnings.warn()",
            }:
                raise InvalidMeasurement("incomplete Sentry SDK warning from checker setup")
            warnings.append("Sentry SDK setup warning: no DSN is configured")
            index += 2
            continue
        if not line:
            index += 1
            continue
        raise InvalidMeasurement(f"unexplained mypy stderr: {line}")
    return tuple(warnings)


def _run_git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ("git", *args),
        cwd=repo,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise InvalidMeasurement(
            f"git {' '.join(args)} failed with {result.returncode}: "
            f"{result.stderr.decode(errors='replace')}"
        )
    try:
        return result.stdout.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise InvalidMeasurement("Git returned non-UTF-8 tree data") from exc


def resolve_tree(repo: Path, reference: str) -> tuple[str, str]:
    commit = _run_git(repo, "rev-parse", "--verify", f"{reference}^{{commit}}").strip()
    tree = _run_git(repo, "rev-parse", "--verify", f"{reference}^{{tree}}").strip()
    return commit, tree


def _tree_hash(repo: Path, reference: str) -> str:
    return _run_git(repo, "rev-parse", "--verify", f"{reference}^{{tree}}").strip()


def extract_tree(repo: Path, tree: str, output: Path) -> Path:
    destination = output / "snapshots" / tree
    if destination.exists():
        raise InvalidMeasurement(f"snapshot already exists: {destination}")
    destination.mkdir(parents=True)
    process = subprocess.Popen(
        ("git", "archive", "--format=tar", tree),
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    try:
        if process.stdout is None:
            raise InvalidMeasurement("git archive did not provide stdout")
        with tarfile.open(fileobj=process.stdout, mode="r|") as archive:
            archive.extractall(destination, filter="data")
        stderr = process.communicate(timeout=60)[1]
    except (OSError, tarfile.TarError, subprocess.TimeoutExpired) as exc:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()
        shutil.rmtree(destination, ignore_errors=True)
        raise InvalidMeasurement(f"could not materialize candidate tree {tree}: {exc}") from exc
    if process.returncode:
        shutil.rmtree(destination, ignore_errors=True)
        raise InvalidMeasurement(
            f"git archive failed for {tree}: {stderr.decode(errors='replace')}"
        )
    return destination


def tree_inventory(repo: Path, tree: str, root: Path) -> tuple[SourceFile, ...]:
    listing = subprocess.run(
        ("git", "ls-tree", "-r", "-z", "--format=%(objectmode)%x09%(path)", tree),
        cwd=repo,
        capture_output=True,
        check=False,
    )
    if listing.returncode:
        raise InvalidMeasurement(
            f"git ls-tree failed with {listing.returncode}: "
            f"{listing.stderr.decode(errors='replace')}"
        )
    records: list[SourceFile] = []
    for raw_record in listing.stdout.split(b"\0"):
        if not raw_record:
            continue
        try:
            mode_raw, path_raw = raw_record.split(b"\t", 1)
            path = path_raw.decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise InvalidMeasurement("Git tree contains an invalid source path") from exc
        if not path.endswith((".py", ".pyi")):
            continue
        if mode_raw == b"120000":
            raise InvalidMeasurement(f"Python source is a symlink in the Git tree: {path}")
        if mode_raw not in {b"100644", b"100755"}:
            raise InvalidMeasurement(f"unsupported Git mode for Python source: {path}")
        records.append(_source_record(path, root))
    by_module: dict[str, SourceFile] = {}
    for record in records:
        if record.module is None or record.kind == SourceKind.VENDORED:
            continue
        previous = by_module.get(record.module)
        if previous is not None and previous.path != record.path:
            if previous.path.endswith(".py") and record.path.endswith(".pyi"):
                continue
            if previous.path.endswith(".pyi") and record.path.endswith(".py"):
                by_module[record.module] = record
                continue
            raise InvalidMeasurement(
                f"duplicate first-party module identity {record.module}: "
                f"{previous.path}, {record.path}"
            )
        by_module[record.module] = record
    return tuple(sorted(records, key=lambda record: record.path))


def _profile_options(profile: Profile) -> tuple[str, ...]:
    if profile != Profile.PRECISION:
        return ()
    return (
        "--warn-return-any",
        "--disallow-any-expr",
        "--disallow-any-unimported",
        "--disallow-any-decorated",
        "--disallow-untyped-calls",
    )


def _checker_arguments(config_path: Path, cache_dir: Path, profile: Profile) -> list[str]:
    return [
        "--config-file",
        str(config_path),
        "--cache-dir",
        str(cache_dir),
        "--no-incremental",
        *_profile_options(profile),
    ]


def _kill_process_group(process: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def _candidate_path(path: str, root: Path) -> str:
    candidate = Path(path)
    return str(candidate if candidate.is_absolute() else root / candidate)


def _snapshot_environment(root: Path) -> dict[str, str]:
    environment = os.environ.copy()
    python_paths = [str(root), str(root / "src")]
    repo_root = REPO_ROOT.resolve()
    for entry in environment.get("PYTHONPATH", "").split(os.pathsep):
        if not entry:
            continue
        entry_path = Path(entry).resolve()
        try:
            entry_path.relative_to(repo_root)
        except ValueError:
            python_paths.append(entry)
    environment["PYTHONPATH"] = os.pathsep.join(python_paths)
    environment["PYTHONWARNINGS"] = "error::RuntimeWarning"
    return environment


def run_profile(
    profile: Profile,
    root: Path,
    tree: str,
    output: Path,
    *,
    source_paths: Sequence[str] = (),
    label: str | None = None,
    timeout_seconds: int = 20 * 60,
) -> ProfileMeasurement:
    profile_dir = output / (label or profile.value)
    profile_dir.mkdir(parents=True, exist_ok=False)
    source = (root / "pyproject.toml").read_text()
    config = profile_config(source, profile, root)
    config_name = f"{profile.value}-{label or 'main'}.toml"
    config_path = root / ".work" / "tmp" / "typing-campaign" / config_name
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(config)
    cache_dir = profile_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    source_list_path: Path | None = None
    if source_paths:
        source_list_path = profile_dir / "sources.json"
        source_list_path.write_text(json.dumps([_candidate_path(path, root) for path in source_paths]))

    environment = _snapshot_environment(root)
    environment["TYPING_CAMPAIGN_MYPY_VERSION"] = EXPECTED_MYPY_VERSION
    environment["TYPING_CAMPAIGN_PRECISION"] = "1" if profile == Profile.PRECISION else "0"
    environment["TYPING_CAMPAIGN_SOURCE_ROOT"] = str(root.resolve())
    if source_list_path is not None:
        environment["TYPING_CAMPAIGN_SOURCE_LIST"] = str(source_list_path)
    else:
        environment.pop("TYPING_CAMPAIGN_SOURCE_LIST", None)
    command = (
        sys.executable,
        "-c",
        _WORKER,
        *_checker_arguments(config_path, cache_dir, profile),
    )
    started = time.monotonic()
    process = subprocess.Popen(
        command,
        cwd=root,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    try:
        worker_stdout, worker_stderr = process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        _kill_process_group(process)
        (profile_dir / "worker.stdout").write_bytes(exc.stdout or b"")
        (profile_dir / "worker.stderr").write_bytes(exc.stderr or b"")
        raise InvalidMeasurement(
            f"{profile.value} profile timed out after {timeout_seconds} seconds",
            details={
                "subprocess_status": process.returncode,
                "subprocess_stderr": (exc.stderr or b"").decode(errors="replace"),
            },
        ) from exc
    elapsed = time.monotonic() - started
    (profile_dir / "worker.stdout").write_bytes(worker_stdout)
    (profile_dir / "worker.stderr").write_bytes(worker_stderr)
    if process.returncode != 0 or worker_stderr:
        raise InvalidMeasurement(
            f"{profile.value} adapter failed with {process.returncode}: "
            f"{worker_stderr.decode(errors='replace')}",
            details={
                "subprocess_status": process.returncode,
                "subprocess_stderr": worker_stderr.decode(errors="replace"),
            },
        )
    try:
        response = json.loads(worker_stdout)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise InvalidMeasurement(
            f"{profile.value} adapter returned invalid JSON",
            details={
                "subprocess_status": process.returncode,
                "subprocess_stderr": worker_stderr.decode(errors="replace"),
                "subprocess_stdout": worker_stdout.decode(errors="replace"),
            },
        ) from exc
    if response.get("adapter_status") != 0:
        raise InvalidMeasurement(
            f"{profile.value} mypy build failed: {response.get('error', 'unknown adapter error')}",
            details={
                "subprocess_status": process.returncode,
                "adapter_status": response.get("adapter_status"),
                "adapter_stderr": response.get("stderr", ""),
                "adapter_traceback": response.get("traceback", ""),
            },
        )
    if response.get("mypy_version") != EXPECTED_MYPY_VERSION:
        raise InvalidMeasurement(f"unsupported mypy version {response.get('mypy_version')!r}")

    checker_stdout = str(response.get("stdout", ""))
    checker_stderr = str(response.get("stderr", ""))
    (profile_dir / "mypy.stdout").write_text(checker_stdout)
    (profile_dir / "mypy.stderr").write_text(checker_stderr)
    try:
        warnings = _known_environment_warnings(checker_stderr)
    except InvalidMeasurement as exc:
        raise InvalidMeasurement(
            str(exc),
            details={
                "subprocess_status": process.returncode,
                "checker_stderr": checker_stderr,
                "checker_stdout": checker_stdout,
            },
        ) from exc
    for line in checker_stdout.splitlines():
        if not line:
            continue
        diagnostic = parse_diagnostic_line(line)
        if diagnostic is not None and diagnostic.severity == "note":
            continue
        raise InvalidMeasurement(
            f"unrecognized mypy stdout: {line}",
            details={
                "subprocess_status": process.returncode,
                "checker_stderr": checker_stderr,
                "checker_stdout": checker_stdout,
            },
        )

    graph: list[ModuleState] = []
    for raw_state in response.get("graph", []):
        module = str(raw_state["module"])
        module_path = _assert_tree_path(
            str(raw_state["path"]),
            root,
            owned_module=module.split(".", 1)[0] in FIRST_PARTY_ROOTS,
        )
        graph.append(
            ModuleState(
                module=module,
                path=module_path,
                checked=bool(raw_state["checked"]),
                ast_retained=bool(raw_state["ast_retained"]),
                is_stub=bool(raw_state["is_stub"]),
                weak_options=tuple(str(item) for item in raw_state["weak_options"]),
                disabled_codes=tuple(str(item) for item in raw_state["disabled_codes"]),
                follow_imports=str(raw_state["follow_imports"]),
                follow_imports_for_stubs=str(raw_state["follow_imports_for_stubs"]),
                effective_options=tuple(
                    sorted(
                        (str(name), str(value))
                        for name, value in raw_state["effective_options"].items()
                    )
                ),
            )
        )
    _validate_origins(response.get("origins", {}), response.get("loaded_origins", {}), root)

    raw_diagnostics = response.get("diagnostics")
    if not isinstance(raw_diagnostics, list):
        raise InvalidMeasurement("mypy adapter returned invalid diagnostics")
    diagnostics_list = []
    for value in raw_diagnostics:
        line = str(value)
        parsed = parse_diagnostic_line(line)
        if parsed is not None and parsed.severity == "note":
            continue
        diagnostics_list.append(_diagnostic_record(line, root))
    diagnostics = tuple(diagnostics_list)
    raw_checker_status = int(response["checker_status"])
    if raw_checker_status not in (0, 1) or raw_checker_status != int(bool(raw_diagnostics)):
        raise InvalidMeasurement(f"{profile.value} checker status does not match diagnostics")
    checker_status = int(bool(diagnostics))
    raw_any = response.get("any_obligations", {})
    if not isinstance(raw_any, dict):
        raise InvalidMeasurement("precision adapter returned an invalid Any inventory")
    any_obligations = tuple(
        AnyObligation(
            _assert_tree_path(str(item["path"]), root),
            str(item["anchor"]),
            str(item["type_position"]),
            str(item["origin"]),
        )
        for item in raw_any.get("obligations", [])
        if _is_snapshot_path(str(item["path"]), root)
    )
    graph.sort(key=lambda state: (state.module, state.path))
    source_count = _validate_targets(
        response.get("source_count"), response.get("targets"), graph, root
    )
    (profile_dir / "graph.json").write_text(
        json.dumps([asdict(state) for state in graph], indent=2, sort_keys=True)
    )
    result = ProfileMeasurement(
        profile,
        tree,
        checker_status,
        source_count,
        diagnostics,
        tuple(graph),
        any_obligations,
        warnings,
        elapsed,
        int(response["peak_rss_bytes"]) if response.get("peak_rss_bytes") is not None else None,
        profile_dir,
        int(response["adapter_status"]),
        "",
        checker_stderr,
        int(raw_any.get("unanchored_count", 0)),
    )
    (profile_dir / "measurement.json").write_text(
        json.dumps(_profile_report(result), indent=2, sort_keys=True)
    )
    return result


def _validate_origins(
    origins: Mapping[str, object], loaded_origins: Mapping[str, object], root: Path
) -> None:
    for name, origin in origins.items():
        if origin is None:
            continue
        path = Path(str(origin)).resolve()
        if name == "sentry" and (root / "src" / "sentry").exists():
            allowed = (root / "src" / "sentry").resolve()
        elif name == "tools" and (root / "tools").exists():
            allowed = (root / "tools").resolve()
        else:
            continue
        if path != allowed and allowed not in path.parents:
            raise InvalidMeasurement(f"{name} resolves outside the candidate snapshot: {origin}")
    for name, origin in loaded_origins.items():
        if name.split(".", 1)[0] not in FIRST_PARTY_ROOTS:
            continue
        _assert_tree_path(str(origin), root, owned_module=True)


def _validate_targets(
    source_count: object,
    targets: object,
    graph: Sequence[ModuleState],
    root: Path,
) -> int:
    if isinstance(source_count, bool) or not isinstance(source_count, int) or source_count <= 0:
        raise InvalidMeasurement("mypy adapter returned an invalid target count")
    if not isinstance(targets, list) or len(targets) != source_count:
        target_count = len(targets) if isinstance(targets, list) else "invalid"
        raise InvalidMeasurement(
            f"mypy adapter target count mismatch: source_count={source_count}, targets={target_count}"
        )
    states_by_source = {(state.module, state.path): state for state in graph}
    for target in targets:
        if not isinstance(target, dict):
            raise InvalidMeasurement("mypy adapter returned a malformed target")
        module = target.get("module")
        path = target.get("path")
        if not isinstance(module, str) or not isinstance(path, str) or not path:
            raise InvalidMeasurement("mypy adapter returned a target without a source path")
        source_path = _assert_tree_path(path, root, owned_module=True)
        state = states_by_source.get((module, source_path))
        if state is None or not state.ast_retained or not state.checked:
            raise InvalidMeasurement(
                f"mypy target is absent or unchecked in the build graph: {module} ({source_path})"
            )
    return source_count


def _is_snapshot_path(path: str, root: Path) -> bool:
    try:
        Path(path).resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _profile_report(result: ProfileMeasurement) -> dict[str, object]:
    return {
        "profile": result.profile.value,
        "tree": result.tree,
        "checker_status": result.checker_status,
        "source_count": result.source_count,
        "error_count": len(result.diagnostics),
        "diagnostics": [asdict(item) for item in result.diagnostics],
        "graph_state_count": len(result.graph),
        "any_obligation_count": len(result.any_obligations),
        "environment_warnings": list(result.environment_warnings),
        "elapsed_seconds": result.elapsed_seconds,
        "peak_rss_bytes": result.peak_rss_bytes,
        "output_dir": str(result.output_dir),
        "adapter_status": result.adapter_status,
        "adapter_stderr": result.adapter_stderr,
        "checker_stderr": result.checker_stderr,
        "unanchored_any_count": result.unanchored_any_count,
        "reused_from_tree": result.reused_from_tree,
        "reuse_reason": result.reuse_reason,
    }


def _typing_names(
    tree: ast.Module,
) -> tuple[
    set[str],
    set[str],
    set[str],
    set[str],
    set[str],
    set[str],
    tuple[ast.ImportFrom, ...],
]:
    any_names: set[str] = set()
    cast_names: set[str] = set()
    callable_names: set[str] = set()
    no_type_check_names: set[str] = set()
    module_aliases: set[str] = set()
    dict_names: set[str] = set()
    wildcard_imports: list[ast.ImportFrom] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in {"typing", "typing_extensions"}:
                    module_aliases.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module in {"typing", "typing_extensions", "collections.abc"}:
            for alias in node.names:
                if alias.name == "*" and node.module in {"typing", "typing_extensions"}:
                    wildcard_imports.append(node)
                    continue
                local_name = alias.asname or alias.name
                if alias.name == "Any" and node.module in {"typing", "typing_extensions"}:
                    any_names.add(local_name)
                elif alias.name == "cast" and node.module in {"typing", "typing_extensions"}:
                    cast_names.add(local_name)
                elif alias.name == "Callable" and node.module in {"typing", "typing_extensions", "collections.abc"}:
                    callable_names.add(local_name)
                elif alias.name == _NO_TYPE_CHECK_ATTRIBUTE and node.module in {"typing", "typing_extensions"}:
                    no_type_check_names.add(local_name)
                elif alias.name == "Dict" and node.module in {"typing", "typing_extensions"}:
                    dict_names.add(local_name)
    return (
        any_names,
        cast_names,
        callable_names,
        no_type_check_names,
        module_aliases,
        dict_names,
        tuple(wildcard_imports),
    )


def _is_any(node: ast.AST | None, names: set[str], modules: set[str]) -> bool:
    if node is None:
        return False
    for item in ast.walk(node):
        if isinstance(item, ast.Name) and item.id in names:
            return True
        if (
            isinstance(item, ast.Attribute)
            and item.attr == "Any"
            and isinstance(item.value, ast.Name)
            and item.value.id in modules
        ):
            return True
    return False


def _any_nodes(node: ast.AST | None, names: set[str], modules: set[str]) -> tuple[ast.AST, ...]:
    if node is None:
        return ()
    return tuple(
        sorted(
            (
                item
                for item in ast.walk(node)
                if isinstance(item, ast.Name)
                and item.id in names
                or isinstance(item, ast.Attribute)
                and item.attr == "Any"
                and isinstance(item.value, ast.Name)
                and item.value.id in modules
            ),
            key=lambda item: (item.lineno, item.col_offset, type(item).__name__),
        )
    )


def _is_typing_name(node: ast.AST, names: set[str], modules: set[str], attribute: str) -> bool:
    return (isinstance(node, ast.Name) and node.id in names) or (
        isinstance(node, ast.Attribute)
        and node.attr == attribute
        and isinstance(node.value, ast.Name)
        and node.value.id in modules
    )


def _source_contracts(
    source_path: str, root: Path
) -> tuple[
    frozenset[tuple[str, str]],
    Mapping[tuple[str, str, str], str],
    frozenset[tuple[str, str, str]],
    frozenset[AnyObligation],
]:
    try:
        source = (root / source_path).read_text()
        tree = ast.parse(source, filename=source_path)
    except (OSError, SyntaxError, UnicodeDecodeError) as exc:
        raise InvalidMeasurement(f"could not inspect owned source {source_path}: {exc}") from exc
    module = module_identity(source_path) or source_path
    (
        any_names,
        cast_names,
        callable_names,
        no_type_check_names,
        module_aliases,
        dict_names,
        wildcard_imports,
    ) = _typing_names(tree)
    bypasses: set[tuple[str, str]] = set()
    signatures: dict[tuple[str, str, str], str] = {}
    omissions: set[tuple[str, str, str]] = set()
    any_obligations: set[AnyObligation] = set()
    occurrence_counts: Counter[tuple[str, str]] = Counter()

    for index, wildcard_import in enumerate(wildcard_imports, start=1):
        anchor = f"typing-wildcard-import:{wildcard_import.module}#{index}"
        bypasses.add((source_path, anchor))
        any_obligations.add(
            AnyObligation(
                source_path,
                anchor,
                "unresolved-imported-typing-names",
                "unknown-typing-wildcard",
            )
        )

    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type != tokenize.COMMENT:
            continue
        lowered = token.string.lower()
        directive = re.search(r"\btype\s*:\s*ignore(?:\[[^]]*\])?", lowered)
        if directive is None:
            directive = re.search(r"\bmypy\s*:\s*ignore-errors\b", lowered)
        if directive is not None:
            line = source.splitlines()[token.start[0] - 1]
            statement = line.split("#", 1)[0].strip() or "<module>"
            bypasses.add((source_path, f"comment:{statement}:{directive.group(0)}"))
        elif re.search(r"\bmypy\s*:\s*disable[-_]error[-_]code\b", lowered):
            line = source.splitlines()[token.start[0] - 1]
            statement = line.split("#", 1)[0].strip() or "<module>"
            bypasses.add((source_path, f"comment:{statement}:mypy-disable-error-code"))

    def record_signature(
        symbol: str, position: str, annotation: ast.AST | None
    ) -> None:
        key = (source_path, symbol, position)
        if annotation is None:
            signatures[key] = "<missing>"
            omissions.add(key)
            if source_path.endswith(".pyi"):
                bypasses.add((source_path, f"untyped-stub:{symbol}:{position}"))
            return
        annotation_text = ast.unparse(annotation)
        signatures[key] = annotation_text
        for index, _ in enumerate(_any_nodes(annotation, any_names, module_aliases)):
            any_obligations.add(
                AnyObligation(
                    source_path,
                    f"signature:{symbol}",
                    f"{position}:{index}",
                    "explicit",
                )
            )

    def visit(node: ast.AST, scope: tuple[str, ...]) -> None:
        if isinstance(node, ast.ClassDef):
            for child in node.body:
                visit(child, (*scope, node.name))
            return
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            qualified_name = ".".join((module, *scope, node.name))
            occurrence_key = (qualified_name, source_path)
            occurrence_counts[occurrence_key] += 1
            symbol = f"{qualified_name}#{occurrence_counts[occurrence_key]}"
            for decorator in node.decorator_list:
                if _is_typing_name(
                    decorator, no_type_check_names, module_aliases, _NO_TYPE_CHECK_ATTRIBUTE
                ) or (
                    isinstance(decorator, ast.Call)
                    and _is_typing_name(
                        decorator.func,
                        no_type_check_names,
                        module_aliases,
                        _NO_TYPE_CHECK_ATTRIBUTE,
                    )
                ):
                    bypasses.add((source_path, f"no-type-check:{symbol}"))
            arguments = (
                *node.args.posonlyargs,
                *node.args.args,
                *node.args.kwonlyargs,
                *((node.args.vararg,) if node.args.vararg else ()),
                *((node.args.kwarg,) if node.args.kwarg else ()),
            )
            for argument in arguments:
                if argument.arg in {"self", "cls"}:
                    continue
                record_signature(symbol, f"parameter:{argument.arg}", argument.annotation)
            record_signature(symbol, "return", node.returns)
            for type_parameter in getattr(node, "type_params", ()):
                record_signature(
                    symbol,
                    f"generic:{getattr(type_parameter, 'name', type(type_parameter).__name__)}",
                    type_parameter,
                )
            for body_node in node.body:
                visit(body_node, (*scope, node.name))
            return
        for child_node in ast.iter_child_nodes(node):
            visit(child_node, scope)

    visit(tree, ())

    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign):
            target_text = ast.unparse(node.target)
            for index, _ in enumerate(_any_nodes(node.annotation, any_names, module_aliases)):
                any_obligations.add(
                    AnyObligation(
                        source_path,
                        f"annotation:{target_text}:{ast.dump(node.annotation, include_attributes=False)}",
                        f"variable:{index}",
                        "explicit",
                    )
                )
            if _is_any(node.value, any_names, module_aliases):
                for index, _ in enumerate(_any_nodes(node.value, any_names, module_aliases)):
                    any_obligations.add(
                        AnyObligation(
                            source_path,
                            f"type-alias:{target_text}",
                            f"alias:{index}",
                            "explicit",
                        )
                    )
        if isinstance(node, ast.Assign) and _is_any(node.value, any_names, module_aliases):
            for assignment_target in node.targets:
                if isinstance(assignment_target, ast.Name):
                    for index, _ in enumerate(_any_nodes(node.value, any_names, module_aliases)):
                        any_obligations.add(
                            AnyObligation(
                                source_path,
                                f"type-alias:{assignment_target.id}",
                                f"alias:{index}",
                                "explicit",
                            )
                        )
        if isinstance(node, ast.Call) and _is_typing_name(node.func, cast_names, module_aliases, "cast"):
            if node.args and (_is_any(node.args[0], any_names, module_aliases) or ast.unparse(node.args[0]) == "object"):
                bypasses.add((source_path, f"erasing-cast:{ast.unparse(node)}"))
        if not isinstance(node, ast.Subscript):
            continue
        slice_nodes = list(ast.walk(node.slice))
        contains_any = any(
            isinstance(item, ast.Name) and item.id in any_names
            or isinstance(item, ast.Attribute)
            and item.attr == "Any"
            and isinstance(item.value, ast.Name)
            and item.value.id in module_aliases
            for item in slice_nodes
        )
        if not contains_any:
            continue
        if _is_typing_name(node.value, callable_names, module_aliases, "Callable") and any(
            isinstance(item, ast.Constant) and item.value is Ellipsis for item in slice_nodes
        ):
            bypasses.add((source_path, f"callable-any:{ast.unparse(node)}"))
        if (
            isinstance(node.value, ast.Name)
            and (node.value.id == "dict" or node.value.id in dict_names)
        ) or (
            isinstance(node.value, ast.Attribute)
            and node.value.attr == "Dict"
            and isinstance(node.value.value, ast.Name)
            and node.value.value.id in module_aliases
        ):
            bypasses.add((source_path, f"broad-dict-any:{ast.unparse(node)}"))

    return (
        frozenset(bypasses),
        signatures,
        frozenset(omissions),
        frozenset(any_obligations),
    )


def _tree_contracts(
    inventory: Sequence[SourceFile], root: Path
) -> tuple[
    frozenset[tuple[str, str]],
    Mapping[tuple[str, str, str], str],
    frozenset[tuple[str, str, str]],
    frozenset[AnyObligation],
]:
    all_bypasses: set[tuple[str, str]] = set()
    all_signatures: dict[tuple[str, str, str], str] = {}
    all_omissions: set[tuple[str, str, str]] = set()
    all_any: set[AnyObligation] = set()
    for record in inventory:
        if record.kind == SourceKind.VENDORED:
            continue
        bypasses, signatures, omissions, any_obligations = _source_contracts(record.path, root)
        all_bypasses.update(bypasses)
        all_signatures.update(signatures)
        all_omissions.update(omissions)
        all_any.update(any_obligations)
    return (
        frozenset(all_bypasses),
        all_signatures,
        frozenset(all_omissions),
        frozenset(all_any),
    )


def _coverage_set(inventory: Sequence[SourceFile], graph: Sequence[ModuleState]) -> frozenset[str]:
    owned = {record.path: record for record in inventory if record.kind != SourceKind.VENDORED}
    covered: set[str] = set()
    for state in graph:
        record = owned.get(state.path)
        if record is None or not state.ast_retained or not state.checked:
            continue
        covered.add(state.path)
    return frozenset(covered)


def _coverage_gaps(inventory: Sequence[SourceFile], graph: Sequence[ModuleState]) -> tuple[str, ...]:
    gaps: set[str] = set()
    owned = {record.path: record for record in inventory if record.kind != SourceKind.VENDORED}
    states_by_path: dict[str, list[ModuleState]] = {}
    states_by_module: dict[str, list[ModuleState]] = {}
    for state in graph:
        states_by_path.setdefault(state.path, []).append(state)
        states_by_module.setdefault(state.module, []).append(state)
    for record in inventory:
        if record.kind == SourceKind.VENDORED:
            continue
        if record.path.endswith(".py") and record.module is not None:
            matches = states_by_module.get(record.module, [])
            if any(state.path.endswith(".pyi") for state in matches):
                gaps.add(f"{record.path}: an owned stub shadows the implementation")
        states = states_by_path.get(record.path, [])
        if not states:
            gaps.add(f"{record.path}: absent from mypy build graph")
            continue
        if not any(state.ast_retained for state in states):
            gaps.add(f"{record.path}: source AST was not retained")
        if not any(state.checked for state in states):
            gaps.add(f"{record.path}: source was not type-checked")
    for state in graph:
        if state.path not in owned and state.module.split(".", 1)[0] in FIRST_PARTY_ROOTS:
            if state.path.endswith((".py", ".pyi")) and not state.path.startswith(".work/"):
                gaps.add(f"{state.module}: first-party build graph path is not in the source inventory: {state.path}")
    return tuple(sorted(gaps))


def _merge_profiles(
    profile: Profile,
    tree: str,
    primary: ProfileMeasurement,
    supplemental: Sequence[ProfileMeasurement],
) -> ProfileMeasurement:
    graph_by_key = {(state.module, state.path): state for state in primary.graph}
    error_by_key = {diagnostic.key: diagnostic for diagnostic in primary.diagnostics}
    any_by_key = {obligation.key: obligation for obligation in primary.any_obligations}
    warnings = list(primary.environment_warnings)
    elapsed = primary.elapsed_seconds
    peak_rss = primary.peak_rss_bytes
    unanchored_any_count = primary.unanchored_any_count
    for result in supplemental:
        for state in result.graph:
            graph_by_key[(state.module, state.path)] = state
        for diagnostic in result.diagnostics:
            error_by_key[diagnostic.key] = diagnostic
        for obligation in result.any_obligations:
            any_by_key[obligation.key] = obligation
        warnings.extend(result.environment_warnings)
        elapsed += result.elapsed_seconds
        unanchored_any_count += result.unanchored_any_count
        if result.peak_rss_bytes is not None:
            peak_rss = max(peak_rss or 0, result.peak_rss_bytes)
    graph = tuple(sorted(graph_by_key.values(), key=lambda state: (state.module, state.path)))
    diagnostics = tuple(sorted(error_by_key.values(), key=lambda item: _diagnostic_sort_key(item.key)))
    any_obligations = tuple(sorted(any_by_key.values(), key=lambda item: item.key))
    merged = ProfileMeasurement(
        profile,
        tree,
        int(bool(diagnostics)),
        primary.source_count,
        diagnostics,
        graph,
        any_obligations,
        tuple(warnings),
        elapsed,
        peak_rss,
        primary.output_dir,
        unanchored_any_count=unanchored_any_count,
    )
    (primary.output_dir / "merged-graph.json").write_text(
        json.dumps([asdict(state) for state in graph], indent=2, sort_keys=True)
    )
    (primary.output_dir / "merged-measurement.json").write_text(
        json.dumps(_profile_report(merged), indent=2, sort_keys=True)
    )
    return merged


def _coverage_audits(
    primary: ProfileMeasurement,
    inventory: Sequence[SourceFile],
    root: Path,
    tree: str,
    output: Path,
) -> ProfileMeasurement:
    missing = set(record.path for record in inventory if record.kind != SourceKind.VENDORED)
    missing.difference_update(_coverage_set(inventory, primary.graph))
    if not missing:
        return primary
    by_path = {record.path: record for record in inventory}
    supplemental: list[ProfileMeasurement] = []
    importable = sorted(
        path
        for path in missing
        if by_path[path].kind != SourceKind.NON_IMPORTABLE
        and by_path[path].module is not None
        and not (
            path.endswith(".py")
            and any(
                record.module == by_path[path].module and record.path.endswith(".pyi")
                for record in inventory
            )
        )
    )
    if importable:
        supplemental.append(
            run_profile(
                primary.profile,
                root,
                tree,
                output,
                source_paths=importable,
                label=f"{primary.profile.value}-explicit-owned-sources",
            )
        )
    standalone = sorted(
        path
        for path in missing
        if (by_path[path].kind == SourceKind.NON_IMPORTABLE or by_path[path].module is None)
        and path.endswith(".py")
    )
    for batch_index, start in enumerate(range(0, len(standalone), STANDALONE_SOURCE_BATCH_SIZE)):
        source_paths = tuple(standalone[start : start + STANDALONE_SOURCE_BATCH_SIZE])
        supplemental.append(
            run_profile(
                primary.profile,
                root,
                tree,
                output,
                source_paths=source_paths,
                label=f"{primary.profile.value}-standalone-{batch_index:04d}",
            )
        )
    return _merge_profiles(primary.profile, tree, primary, supplemental)


def _effective_pairs(
    inventory: Sequence[SourceFile], graph: Sequence[ModuleState]
) -> tuple[frozenset[tuple[str, str]], frozenset[tuple[str, str]]]:
    owned_paths = {
        record.path for record in inventory if record.kind != SourceKind.VENDORED
    }
    weak: set[tuple[str, str]] = set()
    suppressed: set[tuple[str, str]] = set()
    for state in graph:
        if state.path not in owned_paths:
            continue
        module = state.module
        weak.update((module, option) for option in state.weak_options)
        if state.follow_imports in {"silent", "skip"}:
            weak.add((module, f"follow_imports={state.follow_imports}"))
        if (
            state.is_stub
            and state.follow_imports == "skip"
            and state.follow_imports_for_stubs == "True"
        ):
            weak.add((module, "follow_imports_for_stubs=true"))
        suppressed.update((module, code) for code in state.disabled_codes)
    return frozenset(weak), frozenset(suppressed)


def _owned_diagnostics(
    measurement: ProfileMeasurement, inventory: Sequence[SourceFile]
) -> tuple[DiagnosticRecord, ...]:
    owned_paths = {
        record.path for record in inventory if record.kind != SourceKind.VENDORED
    }
    return tuple(item for item in measurement.diagnostics if item.path in owned_paths)


def _profile_comparison(
    parent: TreeMeasurement, candidate: TreeMeasurement, profile: Profile
) -> tuple[tuple[DiagnosticRecord, ...], tuple[DiagnosticRecord, ...]]:
    parent_result = parent.profiles[profile]
    candidate_result = candidate.profiles[profile]
    parent_errors = _owned_diagnostics(parent_result, parent.inventory)
    candidate_errors = _owned_diagnostics(candidate_result, candidate.inventory)
    return (
        compare_error_debt(parent_errors, candidate_errors),
        compare_error_debt(candidate_errors, parent_errors),
    )


_WEAK_WHEN_FALSE = frozenset(
    {
        "check_untyped_defs",
        "disallow_any_decorated",
        "disallow_any_explicit",
        "disallow_any_expr",
        "disallow_any_generics",
        "disallow_any_unimported",
        "disallow_subclassing_any",
        "disallow_untyped_calls",
        "disallow_untyped_decorators",
        "disallow_untyped_defs",
        "follow_untyped_imports",
        "local_partial_types",
        "strict_equality",
        "strict_equality_for_none",
        "strict_optional",
        "warn_incomplete_stub",
        "warn_no_return",
        "warn_redundant_casts",
        "warn_return_any",
        "warn_unreachable",
        "warn_unused_configs",
        "warn_unused_ignores",
    }
)
_WEAK_WHEN_TRUE = frozenset(
    {
        "allow_empty_bodies",
        "allow_redefinition",
        "allow_redefinition_old",
        "allow_untyped_globals",
        "ignore_errors",
        "ignore_missing_imports",
        "implicit_optional",
        "implicit_reexport",
    }
)


def _effective_option_changes(
    parent: TreeMeasurement, candidate: TreeMeasurement
) -> tuple[
    frozenset[tuple[str, str]],
    frozenset[tuple[str, str]],
    frozenset[tuple[str, str]],
]:
    parent_owned = {
        record.path for record in parent.inventory if record.kind != SourceKind.VENDORED
    }
    candidate_owned = {
        record.path for record in candidate.inventory if record.kind != SourceKind.VENDORED
    }
    parent_states = {
        state.path: state
        for state in parent.profiles[Profile.CONFIGURED].graph
        if state.path in parent_owned
    }
    candidate_states = {
        state.path: state
        for state in candidate.profiles[Profile.CONFIGURED].graph
        if state.path in candidate_owned
    }
    additions: set[tuple[str, str]] = set()
    removals: set[tuple[str, str]] = set()
    import_policy_changes: set[tuple[str, str]] = set()
    for path in set(parent_states) & set(candidate_states):
        parent_state = parent_states[path]
        candidate_state = candidate_states[path]
        module = candidate_state.module
        if parent_state.module != candidate_state.module:
            import_policy_changes.add(
                (module, f"module={parent_state.module}->{candidate_state.module}")
            )
            continue
        previous = dict(parent_state.effective_options)
        current = dict(candidate_state.effective_options)
        for name in previous.keys() & current.keys():
            old = previous[name]
            new = current[name]
            if name in {"follow_imports", "follow_imports_for_stubs"} and old != new:
                import_policy_changes.add((module, f"{name}={old}->{new}"))
                continue
            weakened = (
                (name in _WEAK_WHEN_FALSE and old == "True" and new == "False")
                or (name in _WEAK_WHEN_TRUE and old == "False" and new == "True")
                or (name == "follow_imports" and old != "skip" and new == "skip")
                or (
                    name == "follow_imports_for_stubs"
                    and old == "False"
                    and new == "True"
                    and current.get("follow_imports") == "skip"
                )
            )
            strengthened = (
                (name in _WEAK_WHEN_FALSE and old == "False" and new == "True")
                or (name in _WEAK_WHEN_TRUE and old == "True" and new == "False")
                or (name == "follow_imports" and old == "skip" and new != "skip")
                or (
                    name == "follow_imports_for_stubs"
                    and old == "True"
                    and new == "False"
                    and previous.get("follow_imports") == "skip"
                )
            )
            if weakened:
                additions.add((module, f"{name}={new.lower()}"))
            if strengthened:
                removals.add((module, f"{name}={old.lower()}"))
    return frozenset(additions), frozenset(removals), frozenset(import_policy_changes)


def _annotation_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Subscript):
        return _annotation_name(node.value)
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _annotation_arguments(node: ast.AST) -> tuple[ast.AST, ...] | None:
    if not isinstance(node, ast.Subscript):
        return None
    if isinstance(node.slice, ast.Tuple):
        return tuple(node.slice.elts)
    return (node.slice,)


def _safe_input_widening(previous: str, candidate: str) -> bool:
    try:
        previous_node = ast.parse(previous, mode="eval").body
        candidate_node = ast.parse(candidate, mode="eval").body
    except SyntaxError:
        return False
    previous_name = _annotation_name(previous_node)
    candidate_name = _annotation_name(candidate_node)
    widened_name = {
        ("list", "Sequence"),
        ("List", "Sequence"),
        ("dict", "Mapping"),
        ("Dict", "Mapping"),
    }
    if (previous_name, candidate_name) not in widened_name:
        return False
    previous_arguments = _annotation_arguments(previous_node)
    candidate_arguments = _annotation_arguments(candidate_node)
    if previous_arguments is None or candidate_arguments is None:
        return False
    return len(previous_arguments) == len(candidate_arguments) and all(
        ast.dump(previous_item, include_attributes=False)
        == ast.dump(candidate_item, include_attributes=False)
        for previous_item, candidate_item in zip(previous_arguments, candidate_arguments, strict=True)
    )


def _signature_regressions(
    parent: TreeMeasurement, candidate: TreeMeasurement
) -> tuple[str, ...]:
    reasons: list[str] = []
    removed = set(parent.signatures) - set(candidate.signatures)
    reasons.extend(
        f"signature disappeared or was renamed: {path} {symbol} {position}"
        for path, symbol, position in sorted(removed)
    )
    for key in sorted(set(parent.signatures) & set(candidate.signatures)):
        previous = parent.signatures[key]
        current = candidate.signatures[key]
        if previous == current:
            continue
        path, symbol, position = key
        if previous == "<missing>" and current != "<missing>":
            continue
        if position.startswith("parameter:") and _safe_input_widening(previous, current):
            continue
        previous_any = any(
            item.path == path and item.anchor == f"signature:{symbol}" and item.type_position.startswith(position)
            for item in parent.any_obligations
        )
        current_any = any(
            item.path == path and item.anchor == f"signature:{symbol}" and item.type_position.startswith(position)
            for item in candidate.any_obligations
        )
        if previous_any and not current_any:
            continue
        reasons.append(
            f"unsupported or precision-erasing signature change: {path} {symbol} {position}: "
            f"{previous} -> {current}"
        )
    return tuple(reasons)


def _signature_improvements(
    parent: TreeMeasurement, candidate: TreeMeasurement
) -> tuple[tuple[str, str, str], ...]:
    improvements = []
    for key in sorted(set(parent.signatures) & set(candidate.signatures)):
        previous = parent.signatures[key]
        current = candidate.signatures[key]
        path, symbol, position = key
        if previous == "<missing>" and current != "<missing>":
            improvements.append(key)
            continue
        if position.startswith("parameter:") and _safe_input_widening(previous, current):
            improvements.append(key)
            continue
        previous_any = any(
            item.path == path and item.anchor == f"signature:{symbol}" and item.type_position.startswith(position)
            for item in parent.any_obligations
        )
        current_any = any(
            item.path == path and item.anchor == f"signature:{symbol}" and item.type_position.startswith(position)
            for item in candidate.any_obligations
        )
        if previous_any and not current_any:
            improvements.append(key)
    return tuple(improvements)


def _module_for_path(path: str, inventory: Sequence[SourceFile]) -> str:
    for record in inventory:
        if record.path == path and record.module is not None:
            return record.module
    return path


def decide_candidate(
    parent: TreeMeasurement,
    candidate: TreeMeasurement,
    *,
    require_adoption_credit: bool,
    precision_calibrated: bool = False,
) -> Decision:
    core_profiles = (Profile.CONFIGURED, Profile.UNSUPPRESSED, Profile.ALL_STRONG)
    missing_profiles = [
        profile.value
        for profile in core_profiles
        if profile not in parent.profiles or profile not in candidate.profiles
    ]
    reasons: list[str] = []
    if missing_profiles:
        return Decision(
            Outcome.INVALID,
            (f"missing core profile measurements: {', '.join(missing_profiles)}",),
            False,
            False,
            False,
        )
    gaps = sorted(set(parent.gaps) | set(candidate.gaps))
    if gaps:
        return Decision(Outcome.INVALID, tuple(gaps), False, False, False)

    weak_additions = candidate.weak_pairs - parent.weak_pairs
    suppression_additions = candidate.suppressed_pairs - parent.suppressed_pairs
    option_weak_additions, option_weak_removals, import_policy_changes = _effective_option_changes(
        parent, candidate
    )
    if weak_additions:
        reasons.extend(
            f"new weak setting {module}: {setting}"
            for module, setting in sorted(weak_additions)
        )
    if suppression_additions:
        reasons.extend(
            f"new suppression {module}: {code}"
            for module, code in sorted(suppression_additions)
        )
    if option_weak_additions:
        reasons.extend(
            f"new effective weakening {module}: {setting}"
            for module, setting in sorted(option_weak_additions)
        )
    if import_policy_changes:
        reasons.extend(
            f"changed effective import policy {module}: {setting}"
            for module, setting in sorted(import_policy_changes)
        )

    source_removals = set(parent.source_digests) - set(candidate.source_digests)
    source_changes = {
        path
        for path in set(parent.source_digests) | set(candidate.source_digests)
        if parent.source_digests.get(path) != candidate.source_digests.get(path)
    }
    if source_removals:
        reasons.extend(f"owned source was removed: {path}" for path in sorted(source_removals))

    configured_additions, configured_removals = _profile_comparison(
        parent, candidate, Profile.CONFIGURED
    )
    allstrong_additions, allstrong_removals = _profile_comparison(
        parent, candidate, Profile.ALL_STRONG
    )
    unsuppressed_additions, unsuppressed_removals = _profile_comparison(
        parent, candidate, Profile.UNSUPPRESSED
    )
    precision_additions: tuple[DiagnosticRecord, ...] = ()
    precision_removals: tuple[DiagnosticRecord, ...] = ()
    if Profile.PRECISION in parent.profiles and Profile.PRECISION in candidate.profiles:
        precision_additions, precision_removals = _profile_comparison(
            parent, candidate, Profile.PRECISION
        )
    for profile_name, additions in (
        (Profile.CONFIGURED.value, configured_additions),
        (Profile.ALL_STRONG.value, allstrong_additions),
        (Profile.UNSUPPRESSED.value, unsuppressed_additions),
        (Profile.PRECISION.value, precision_additions),
    ):
        reasons.extend(
            f"new {profile_name} error {item.path} [{item.code}]: {item.message}"
            for item in additions
        )

    bypass_additions = candidate.bypasses - parent.bypasses
    omission_additions = candidate.signature_omissions - parent.signature_omissions
    any_additions = candidate.any_obligations - parent.any_obligations
    reasons.extend(
        f"new typing bypass {path}: {anchor}"
        for path, anchor in sorted(bypass_additions)
    )
    reasons.extend(
        f"new signature omission {path}: {symbol} {position}"
        for path, symbol, position in sorted(omission_additions)
    )
    reasons.extend(
        f"new Any obligation {item.path}: {item.anchor} {item.type_position} ({item.origin})"
        for item in sorted(any_additions, key=lambda obligation: obligation.key)
    )

    source_signature_changes = _signature_regressions(parent, candidate)
    signature_improvements = _signature_improvements(parent, candidate)
    if source_changes and not (
        precision_calibrated
        and Profile.PRECISION in parent.profiles
        and Profile.PRECISION in candidate.profiles
        and not parent.precision_gaps
        and not candidate.precision_gaps
        and not parent.profiles[Profile.PRECISION].unanchored_any_count
        and not candidate.profiles[Profile.PRECISION].unanchored_any_count
        and not any(item.origin.startswith("unknown-") for item in parent.any_obligations)
        and not any(item.origin.startswith("unknown-") for item in candidate.any_obligations)
    ):
        reasons.append(
            "source changes require calibrated precision extraction; global canaries are incomplete"
        )
    elif source_changes:
        reasons.extend(source_signature_changes)

    removed_weak = parent.weak_pairs - candidate.weak_pairs
    removed_suppressions = parent.suppressed_pairs - candidate.suppressed_pairs
    removed_bypasses = parent.bypasses - candidate.bypasses
    removed_any = parent.any_obligations - candidate.any_obligations
    removed_omissions = parent.signature_omissions - candidate.signature_omissions
    changed_source_modules = {
        _module_for_path(path, candidate.inventory)
        for path in source_changes
        if path in candidate.source_digests and not path.startswith("tests/")
    }

    def credit_path_module(path: str) -> str | None:
        if path.startswith("tests/") and changed_source_modules:
            return None
        return _module_for_path(path, parent.inventory)

    credited_modules = {
        module for module, _ in removed_weak | removed_suppressions | option_weak_removals
    }
    credited_modules.update(
        module
        for item in (*allstrong_removals, *unsuppressed_removals, *precision_removals)
        if (module := credit_path_module(item.path)) is not None
    )
    credited_modules.update(
        module
        for path, _ in removed_bypasses
        if (module := credit_path_module(path)) is not None
    )
    credited_modules.update(
        module
        for item in removed_any
        if (module := credit_path_module(item.path)) is not None
    )
    credited_modules.update(
        module
        for path, _, _ in removed_omissions
        if (module := credit_path_module(path)) is not None
    )
    credited_modules.update(
        module
        for path, _, _ in signature_improvements
        if (module := credit_path_module(path)) is not None
    )
    if require_adoption_credit and len(credited_modules) > 1:
        reasons.append(
            "candidate combines typing debt removals across modules: "
            + ", ".join(sorted(credited_modules))
        )
    if require_adoption_credit and len(changed_source_modules) > 1:
        reasons.append(
            "candidate changes source in multiple modules: "
            + ", ".join(sorted(changed_source_modules))
        )
    if (
        require_adoption_credit
        and changed_source_modules
        and credited_modules
        and not credited_modules.issubset(changed_source_modules)
    ):
        reasons.append(
            "candidate changes source and removes debt from different modules: "
            + ", ".join(sorted(credited_modules | changed_source_modules))
        )
    adoption_credit = bool(
        removed_weak
        or removed_suppressions
        or option_weak_removals
        or allstrong_removals
        or unsuppressed_removals
        or removed_bypasses
        or removed_any
        or removed_omissions
        or signature_improvements
    )
    precision_complete = bool(
        source_changes
        and precision_calibrated
        and Profile.PRECISION in parent.profiles
        and Profile.PRECISION in candidate.profiles
        and not parent.precision_gaps
        and not candidate.precision_gaps
        and not parent.profiles[Profile.PRECISION].unanchored_any_count
        and not candidate.profiles[Profile.PRECISION].unanchored_any_count
        and not any(item.origin.startswith("unknown-") for item in parent.any_obligations)
        and not any(item.origin.startswith("unknown-") for item in candidate.any_obligations)
    )
    if require_adoption_credit and not adoption_credit:
        reasons.append("candidate removes no measured typing debt")

    core_complete = True
    details = {
        "source_changes": sorted(source_changes),
        "source_removals": sorted(source_removals),
        "weak_additions": sorted(weak_additions),
        "weak_removals": sorted(removed_weak),
        "suppression_additions": sorted(suppression_additions),
        "suppression_removals": sorted(removed_suppressions),
        "effective_weakening_additions": sorted(option_weak_additions),
        "effective_weakening_removals": sorted(option_weak_removals),
        "effective_import_policy_changes": sorted(import_policy_changes),
        "configured_error_additions": [asdict(item) for item in configured_additions],
        "configured_error_removals": [asdict(item) for item in configured_removals],
        "all_strong_error_additions": [asdict(item) for item in allstrong_additions],
        "all_strong_error_removals": [asdict(item) for item in allstrong_removals],
        "unsuppressed_error_additions": [asdict(item) for item in unsuppressed_additions],
        "unsuppressed_error_removals": [asdict(item) for item in unsuppressed_removals],
        "precision_error_additions": [asdict(item) for item in precision_additions],
        "precision_error_removals": [asdict(item) for item in precision_removals],
        "new_bypasses": sorted(bypass_additions),
        "new_signature_omissions": sorted(omission_additions),
        "new_any_obligations": [asdict(item) for item in sorted(any_additions, key=lambda obligation: obligation.key)],
        "removed_signature_omissions": sorted(removed_omissions),
        "signature_improvements": list(signature_improvements),
        "credited_modules": sorted(credited_modules),
        "changed_source_modules": sorted(changed_source_modules),
        "signature_regressions": list(source_signature_changes),
    }
    if reasons:
        return Decision(
            Outcome.REJECTED,
            tuple(reasons),
            adoption_credit,
            core_complete,
            precision_complete,
            details,
        )
    return Decision(
        Outcome.COMPLETE,
        (),
        adoption_credit,
        core_complete,
        precision_complete,
        details,
    )


def decide_terminal(
    measurement: TreeMeasurement, *, precision_calibrated: bool = False
) -> Decision:
    reasons: list[str] = []
    required_profiles = set(Profile)
    missing_profiles = required_profiles - measurement.profiles.keys()
    if missing_profiles:
        return Decision(
            Outcome.INVALID,
            ("terminal measurement omitted profiles: " + ", ".join(sorted(item.value for item in missing_profiles)),),
            False,
            False,
            False,
        )
    if measurement.gaps:
        return Decision(Outcome.INVALID, measurement.gaps, False, False, False)
    if measurement.precision_gaps:
        reasons.extend(f"precision coverage gap: {gap}" for gap in measurement.precision_gaps)
    if measurement.weak_pairs:
        reasons.append(f"{len(measurement.weak_pairs)} effective weak settings remain")
    if measurement.suppressed_pairs:
        reasons.append(f"{len(measurement.suppressed_pairs)} owned suppressions remain")
    if measurement.signature_omissions:
        reasons.append(f"{len(measurement.signature_omissions)} signature or generic annotations are missing")
    if measurement.bypasses:
        reasons.append(f"{len(measurement.bypasses)} typing bypasses remain")
    allstrong_errors = _owned_diagnostics(
        measurement.profiles[Profile.ALL_STRONG], measurement.inventory
    )
    configured_errors = _owned_diagnostics(
        measurement.profiles[Profile.CONFIGURED], measurement.inventory
    )
    if allstrong_errors:
        reasons.append(f"{len(allstrong_errors)} all-strong errors remain")
    if configured_errors:
        reasons.append(f"{len(configured_errors)} configured-profile errors remain")
    precision = measurement.profiles[Profile.PRECISION]
    if precision.unanchored_any_count:
        reasons.append(f"{precision.unanchored_any_count} Any expressions lack stable AST anchors")
    precision_errors = _owned_diagnostics(precision, measurement.inventory)
    if precision_errors:
        reasons.append(f"{len(precision_errors)} precision diagnostics remain")
    if measurement.any_obligations:
        reasons.append(f"{len(measurement.any_obligations)} owned Any obligations remain")
    unknown_origins = {
        item.origin for item in measurement.any_obligations if item.origin.startswith("unknown-")
    }
    if unknown_origins:
        reasons.append("unrecognized Any origins: " + ", ".join(sorted(unknown_origins)))
    if not precision_calibrated:
        reasons.append("precision canaries have not been calibrated")
    core_reasons = (
        measurement.weak_pairs
        or measurement.suppressed_pairs
        or measurement.signature_omissions
        or measurement.bypasses
        or allstrong_errors
        or configured_errors
    )
    core_complete = not bool(core_reasons)
    precision_complete = bool(
        precision_calibrated
        and not measurement.precision_gaps
        and not precision.unanchored_any_count
        and not unknown_origins
        and not precision_errors
        and not measurement.any_obligations
    )
    return Decision(
        Outcome.COMPLETE if core_complete and precision_complete and not reasons else Outcome.REJECTED,
        tuple(reasons),
        False,
        core_complete,
        precision_complete,
        {
            "weak_pair_count": len(measurement.weak_pairs),
            "suppressed_pair_count": len(measurement.suppressed_pairs),
            "signature_omission_count": len(measurement.signature_omissions),
            "bypass_count": len(measurement.bypasses),
            "all_strong_error_count": len(allstrong_errors),
            "configured_error_count": len(configured_errors),
            "any_obligation_count": len(measurement.any_obligations),
            "precision_gaps": list(measurement.precision_gaps),
        },
    )


def _measure_tree(
    repo: Path,
    revision: str,
    tree: str,
    output: Path,
    profiles: Sequence[Profile],
    reuse_from: TreeMeasurement | None = None,
) -> TreeMeasurement:
    root = extract_tree(repo, tree, output)
    inventory = tree_inventory(repo, tree, root)
    source_digests = _source_digests(inventory, root)
    tree_output = output / "trees" / tree
    tree_output.mkdir(parents=True, exist_ok=True)
    measured: dict[Profile, ProfileMeasurement] = {}
    gaps: list[str] = []
    precision_gaps: list[str] = []
    required_profiles = {Profile.CONFIGURED, Profile.UNSUPPRESSED, Profile.ALL_STRONG}
    if not required_profiles.issubset(profiles):
        raise InvalidMeasurement("tree measurement omitted a required core profile")
    for profile in profiles:
        result = _reusable_profile(reuse_from, profile, inventory, source_digests)
        reused = result is not None
        if result is None:
            result = run_profile(profile, root, tree, tree_output, label=profile.value)
        if profile in (Profile.CONFIGURED, Profile.UNSUPPRESSED, Profile.ALL_STRONG, Profile.PRECISION):
            if reused:
                profile_gaps = _coverage_gaps(inventory, result.graph)
            else:
                result = _coverage_audits(result, inventory, root, tree, tree_output)
                profile_gaps = _coverage_gaps(inventory, result.graph)
            if profile == Profile.PRECISION:
                precision_gaps.extend(profile_gaps)
            else:
                gaps.extend(profile_gaps)
        measured[profile] = result

    weak_pairs, suppressed_pairs = _effective_pairs(
        inventory, measured[Profile.CONFIGURED].graph
    )
    core_coverage = {
        profile: _coverage_set(inventory, measured[profile].graph)
        for profile in (Profile.CONFIGURED, Profile.UNSUPPRESSED, Profile.ALL_STRONG)
    }
    configured_coverage = core_coverage[Profile.CONFIGURED]
    for profile, coverage in core_coverage.items():
        if coverage != configured_coverage:
            missing = sorted(configured_coverage - coverage)
            extra = sorted(coverage - configured_coverage)
            gaps.append(
                f"{profile.value} source coverage differs from configured: "
                f"missing={missing[:10]}, extra={extra[:10]}"
            )
    reusable_contracts = (
        reuse_from
        if reuse_from is not None
        and not reuse_from.gaps
        and Profile.PRECISION not in reuse_from.profiles
        and Profile.PRECISION not in profiles
        and reuse_from.inventory == inventory
        and reuse_from.source_digests == source_digests
        else None
    )
    if reusable_contracts is not None:
        bypasses = reusable_contracts.bypasses
        signatures = reusable_contracts.signatures
        omissions = reusable_contracts.signature_omissions
        explicit_any = reusable_contracts.any_obligations
        source_contracts_reused_from_tree = reusable_contracts.tree
    else:
        bypasses, signatures, omissions, explicit_any = _tree_contracts(inventory, root)
        source_contracts_reused_from_tree = None
    owned_paths = {
        record.path for record in inventory if record.kind != SourceKind.VENDORED
    }
    all_any = {item for item in explicit_any if item.path in owned_paths}
    if Profile.PRECISION in measured:
        all_any.update(
            item
            for item in measured[Profile.PRECISION].any_obligations
            if item.path in owned_paths
        )
    (output / "inventory.json").write_text(
        json.dumps([asdict(item) for item in inventory], indent=2, sort_keys=True)
    )
    return TreeMeasurement(
        revision,
        tree,
        root,
        inventory,
        measured,
        tuple(sorted(set(gaps))),
        tuple(sorted(set(precision_gaps))),
        weak_pairs,
        suppressed_pairs,
        bypasses,
        signatures,
        omissions,
        frozenset(all_any),
        core_coverage[Profile.ALL_STRONG],
        source_digests,
        source_contracts_reused_from_tree,
    )


def _source_digests(inventory: Sequence[SourceFile], root: Path) -> dict[str, str]:
    return {
        record.path: hashlib.sha256((root / record.path).read_bytes()).hexdigest()
        for record in inventory
        if record.kind != SourceKind.VENDORED
    }


def _reusable_profile(
    parent: TreeMeasurement | None,
    profile: Profile,
    inventory: Sequence[SourceFile],
    source_digests: Mapping[str, str],
) -> ProfileMeasurement | None:
    if parent is None or profile != Profile.ALL_STRONG:
        return None
    if parent.gaps or parent.inventory != tuple(inventory) or parent.source_digests != source_digests:
        return None
    result = parent.profiles.get(profile)
    if (
        result is None
        or result.profile != profile
        or result.tree != parent.tree
        or result.adapter_status != 0
        or result.checker_status not in (0, 1)
        or _coverage_gaps(inventory, result.graph)
        or parent.coverage != _coverage_set(inventory, result.graph)
    ):
        return None
    return replace(
        result,
        reused_from_tree=parent.tree,
        reuse_reason="weaklist-only candidate with identical inventory and source digests",
    )


_POLICY_PATHS = (
    "tools/mypy_helpers/typing_campaign.py",
    "tools/mypy_helpers/mypy_output.py",
    "tools/mypy_helpers/mypy_config.py",
    "tools/mypy_helpers/config_sections.py",
)
_CORE_PROFILES = (Profile.CONFIGURED, Profile.UNSUPPRESSED, Profile.ALL_STRONG)


def _tree_file(repo: Path, tree: str, path: str) -> bytes | None:
    result = subprocess.run(
        ("git", "show", f"{tree}:{path}"),
        cwd=repo,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        return None
    return result.stdout


def _assert_trusted_policy(repo: Path) -> None:
    for relative_path in _POLICY_PATHS:
        trusted_path = repo / relative_path
        committed_content = _tree_file(repo, "HEAD", relative_path)
        if committed_content is None or not trusted_path.is_file():
            raise InvalidMeasurement(
                f"HEAD does not contain the trusted evaluator dependency {relative_path}"
            )
        if trusted_path.read_bytes() != committed_content:
            raise InvalidMeasurement(
                f"working evaluator differs from committed HEAD at {relative_path}"
            )


def _validate_generated_mypy_section(source: str, section_name: str) -> None:
    try:
        section = marked_section(source, section_name)
        if section is None:
            return
        parsed = tomllib.loads(source[section.content_start : section.content_end])
    except (InvalidMarkedSection, tomllib.TOMLDecodeError) as exc:
        raise InvalidMeasurement(
            f"generated mypy section {section_name!r} is invalid: {exc}"
        ) from exc
    if not parsed:
        return
    if set(parsed) != {"tool"}:
        raise InvalidMeasurement(
            f"generated mypy section {section_name!r} contains unsupported settings"
        )
    tool = parsed.get("tool")
    mypy = tool.get("mypy") if isinstance(tool, dict) else None
    overrides = mypy.get("overrides") if isinstance(mypy, dict) else None
    if not isinstance(overrides, list):
        raise InvalidMeasurement(
            f"generated mypy section {section_name!r} must contain only overrides"
        )
    expected_keys = (
        {"module", "disable_error_code"}
        if section_name == ERROR_SECTION
        else {"module", *WEAK_OPTIONS}
    )
    for override in overrides:
        if not isinstance(override, dict) or set(override) != expected_keys:
            raise InvalidMeasurement(
                f"generated mypy section {section_name!r} contains unsupported override fields"
            )
        modules = override.get("module")
        if not isinstance(modules, list) or any(
            not isinstance(module, str) or not module for module in modules
        ):
            raise InvalidMeasurement(
                f"generated mypy section {section_name!r} has an invalid module list"
            )
        if section_name == ERROR_SECTION:
            error_codes = override.get("disable_error_code")
            if not isinstance(error_codes, list) or any(
                not isinstance(code, str) for code in error_codes
            ):
                raise InvalidMeasurement(
                    f"generated mypy section {section_name!r} has invalid error codes"
                )
        elif any(type(override[option]) is not bool or override[option] for option in WEAK_OPTIONS):
            raise InvalidMeasurement(
                f"generated mypy section {section_name!r} has invalid weak options"
            )


def _mypy_config_policy(source: str) -> dict[str, object]:
    try:
        for section_name in (ERROR_SECTION, WEAK_SECTION):
            _validate_generated_mypy_section(source, section_name)
            source = clear_marked_section(source, section_name)
        return tomllib.loads(source)
    except (InvalidMarkedSection, tomllib.TOMLDecodeError) as exc:
        raise InvalidMeasurement(f"mypy configuration is invalid: {exc}") from exc


def _generated_mypy_pairs(source: str, section_name: str) -> frozenset[tuple[str, str]]:
    _validate_generated_mypy_section(source, section_name)
    try:
        section = marked_section(source, section_name)
        if section is None:
            return frozenset()
        parsed = tomllib.loads(source[section.content_start : section.content_end])
    except (InvalidMarkedSection, tomllib.TOMLDecodeError) as exc:
        raise InvalidMeasurement(
            f"generated mypy section {section_name!r} is invalid: {exc}"
        ) from exc
    if not parsed:
        return frozenset()
    overrides = parsed["tool"]["mypy"]["overrides"]
    if section_name == ERROR_SECTION:
        return frozenset(
            (module, code)
            for override in overrides
            for module in override["module"]
            for code in override["disable_error_code"]
        )
    return frozenset(
        (module, option)
        for override in overrides
        for module in override["module"]
        for option in WEAK_OPTIONS
    )


def _policy_changes(repo: Path, parent_tree: str, candidate_tree: str) -> tuple[str, ...]:
    changed = []
    for relative_path in _POLICY_PATHS:
        if _tree_file(repo, parent_tree, relative_path) != _tree_file(
            repo, candidate_tree, relative_path
        ):
            changed.append(relative_path)
    parent_config = _tree_file(repo, parent_tree, "pyproject.toml")
    candidate_config = _tree_file(repo, candidate_tree, "pyproject.toml")
    if parent_config is None or candidate_config is None:
        raise InvalidMeasurement("accepted and candidate trees must contain pyproject.toml")
    try:
        parent_policy = _mypy_config_policy(parent_config.decode("utf-8"))
        candidate_policy = _mypy_config_policy(candidate_config.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise InvalidMeasurement("pyproject.toml is not UTF-8") from exc
    for section_name in (ERROR_SECTION, WEAK_SECTION):
        parent_pairs = _generated_mypy_pairs(parent_config.decode("utf-8"), section_name)
        candidate_pairs = _generated_mypy_pairs(candidate_config.decode("utf-8"), section_name)
        if candidate_pairs - parent_pairs:
            changed.append("pyproject.toml")
            break
    if parent_policy != candidate_policy:
        changed.append("pyproject.toml")
    return tuple(dict.fromkeys(changed))


def _changed_source_paths(repo: Path, parent_tree: str, candidate_tree: str) -> tuple[str, ...]:
    result = subprocess.run(
        (
            "git",
            "diff",
            "--name-only",
            "-z",
            parent_tree,
            candidate_tree,
            "--",
            "*.py",
            "*.pyi",
        ),
        cwd=repo,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise InvalidMeasurement(
            f"git diff failed with {result.returncode}: {result.stderr.decode(errors='replace')}"
        )
    try:
        return tuple(sorted(path.decode("utf-8") for path in result.stdout.split(b"\0") if path))
    except UnicodeDecodeError as exc:
        raise InvalidMeasurement("Git returned a non-UTF-8 source path") from exc


def _changed_tree_paths(repo: Path, parent_tree: str, candidate_tree: str) -> tuple[str, ...]:
    result = subprocess.run(
        ("git", "diff", "--name-only", "-z", parent_tree, candidate_tree),
        cwd=repo,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise InvalidMeasurement(
            f"git diff failed with {result.returncode}: {result.stderr.decode(errors='replace')}"
        )
    try:
        return tuple(sorted(path.decode("utf-8") for path in result.stdout.split(b"\0") if path))
    except UnicodeDecodeError as exc:
        raise InvalidMeasurement("Git returned a non-UTF-8 path") from exc


def _candidate_allstrong_reuse_allowed(
    repo: Path,
    parent_tree: str,
    candidate_tree: str,
    source_changes: Sequence[str],
    parent: TreeMeasurement,
) -> bool:
    if candidate_tree == parent_tree or source_changes or parent.tree != parent_tree or parent.gaps:
        return False
    result = parent.profiles.get(Profile.ALL_STRONG)
    if (
        result is None
        or result.profile != Profile.ALL_STRONG
        or result.tree != parent_tree
        or result.adapter_status != 0
        or result.checker_status not in (0, 1)
    ):
        return False
    if _changed_tree_paths(repo, parent_tree, candidate_tree) != ("pyproject.toml",):
        return False
    parent_config = _tree_file(repo, parent_tree, "pyproject.toml")
    candidate_config = _tree_file(repo, candidate_tree, "pyproject.toml")
    if parent_config is None or candidate_config is None:
        return False
    try:
        return clear_marked_section(
            parent_config.decode("utf-8"), WEAK_SECTION
        ) == clear_marked_section(candidate_config.decode("utf-8"), WEAK_SECTION)
    except (InvalidMarkedSection, UnicodeDecodeError):
        return False


def _tree_report(measurement: TreeMeasurement) -> dict[str, object]:
    return {
        "revision": measurement.revision,
        "tree": measurement.tree,
        "source_count": len(measurement.inventory),
        "inventory": [asdict(item) for item in measurement.inventory],
        "profiles": {
            profile.value: _profile_report(result)
            for profile, result in measurement.profiles.items()
        },
        "core_gaps": list(measurement.gaps),
        "precision_gaps": list(measurement.precision_gaps),
        "weak_pairs": sorted(measurement.weak_pairs),
        "suppressed_pairs": sorted(measurement.suppressed_pairs),
        "bypasses": sorted(measurement.bypasses),
        "signatures": [
            {"path": path, "symbol": symbol, "position": position, "annotation": annotation}
            for (path, symbol, position), annotation in sorted(measurement.signatures.items())
        ],
        "signature_omissions": sorted(measurement.signature_omissions),
        "any_obligations": [
            asdict(item) for item in sorted(measurement.any_obligations, key=lambda item: item.key)
        ],
        "coverage": sorted(measurement.coverage),
        "source_digests": dict(sorted(measurement.source_digests.items())),
        "source_contracts_reused_from_tree": measurement.source_contracts_reused_from_tree,
    }


def _clean_json(value: object) -> object:
    if isinstance(value, StrEnum):
        return value.value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _clean_json(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)):
        return sorted((_clean_json(item) for item in value), key=str)
    if isinstance(value, tuple | list):
        return [_clean_json(item) for item in value]
    return value


def _write_report(output: Path, report: Mapping[str, object]) -> None:
    (output / "report.json").write_text(
        json.dumps(_clean_json(report), indent=2, sort_keys=True) + "\n"
    )


def _prepare_output(repo: Path, requested: str) -> Path:
    output = Path(requested)
    if not output.is_absolute():
        output = repo / output
    output = output.resolve()
    allowed = (repo / ".work" / "tmp").resolve()
    try:
        output.relative_to(allowed)
    except ValueError as exc:
        raise InvalidMeasurement("evaluator output must be under .work/tmp") from exc
    output.mkdir(parents=True, exist_ok=False)
    return output


def _run_precision_canaries(output: Path) -> dict[str, object]:
    canary_root = output / "canaries" / "snapshot"
    integration = canary_root / "src" / "sentry"
    stubs = canary_root / "stubs"
    integration.mkdir(parents=True)
    stubs.mkdir(parents=True)
    (integration / "__init__.py").write_text("")
    (integration / "plugin_api.py").write_text(
        "def injected() -> int:\n    return 1\n"
    )
    (integration / "integration.py").write_text(
        "from external_api import fetch\n"
        "from sentry.plugin_api import injected\n\n"
        "def needs_int(value: int) -> None:\n    pass\n\n"
        "needs_int(1)\n"
        "needs_int('invalid')\n"
        "fetch()\n"
        "injected()\n"
    )
    (stubs / "external_api.pyi").write_text(
        "from typing import Any\n\ndef fetch() -> Any: ...\n"
    )
    (canary_root / "campaign_plugin.py").write_text(
        "from mypy.plugin import FunctionContext, Plugin\n"
        "from mypy.types import AnyType, Type, TypeOfAny\n\n"
        "class CampaignPlugin(Plugin):\n"
        "    def get_function_hook(self, fullname: str):\n"
        "        if fullname == 'sentry.plugin_api.injected':\n"
        "            return self.inject\n"
        "        return None\n\n"
        "    def inject(self, context: FunctionContext) -> Type:\n"
        "        return AnyType(TypeOfAny.special_form)\n\n"
        "def plugin(version: str):\n    return CampaignPlugin\n"
    )
    (canary_root / "pyproject.toml").write_text(
        "[tool.mypy]\n"
        "python_version = '3.13'\n"
        "files = ['src/sentry/integration.py']\n"
        "mypy_path = ['src', 'stubs']\n"
        "plugins = ['campaign_plugin']\n"
        "namespace_packages = true\n"
        "explicit_package_bases = true\n"
    )
    measurements = output / "canaries" / "measurements"
    measurements.mkdir()
    api_result = run_profile(
        Profile.PRECISION,
        canary_root,
        "precision-canary-tree",
        measurements,
        timeout_seconds=120,
    )
    origins = {item.origin for item in api_result.any_obligations}
    required_origins = {"explicit", "special_form"}
    if not required_origins.issubset(origins):
        raise InvalidMeasurement(
            "precision canary failed to detect imported and plugin Any",
            details={"origins": sorted(origins), "required_origins": sorted(required_origins)},
        )
    if api_result.unanchored_any_count:
        raise InvalidMeasurement(
            "precision canary produced an unstable Any anchor",
            details={"unanchored_any_count": api_result.unanchored_any_count},
        )
    api_errors = api_result.diagnostics
    if not any(item.code == "arg-type" for item in api_errors):
        raise InvalidMeasurement("precision canary did not reject its invalid typed call")

    config_path = canary_root / ".work" / "tmp" / "typing-campaign" / "precision-main.toml"
    cli_cache = measurements / "cli-cache"
    cli_cache.mkdir()
    cli_command = (
        sys.executable,
        "-m",
        "mypy",
        *_checker_arguments(config_path, cli_cache, Profile.PRECISION),
        "--show-error-codes",
        "--num-workers",
        "0",
    )
    cli_environment = _snapshot_environment(canary_root)
    started = time.monotonic()
    process = subprocess.Popen(
        cli_command,
        cwd=canary_root,
        env=cli_environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(timeout=120)
    except subprocess.TimeoutExpired as exc:
        _kill_process_group(process)
        raise InvalidMeasurement(
            "precision CLI canary timed out",
            details={
                "subprocess_status": process.returncode,
                "subprocess_stderr": (exc.stderr or b"").decode(errors="replace"),
            },
        ) from exc
    elapsed = time.monotonic() - started
    (measurements / "cli.stdout").write_bytes(stdout)
    (measurements / "cli.stderr").write_bytes(stderr)
    try:
        cli_run = parse_mypy_output(stdout, stderr, process.returncode)
    except InvalidMypyOutput as exc:
        raise InvalidMeasurement(
            f"precision CLI canary output is invalid: {exc}",
            details={
                "subprocess_status": process.returncode,
                "subprocess_stderr": stderr.decode(errors="replace"),
                "subprocess_stdout": stdout.decode(errors="replace"),
            },
        ) from exc
    cli_errors = tuple(
        DiagnosticRecord(
            _assert_tree_path(str(item.filename), canary_root),
            item.code,
            item.message,
        )
        for item in cli_run.errors
        if item.filename is not None
    )
    if Counter(item.key for item in cli_errors) != Counter(item.key for item in api_errors):
        raise InvalidMeasurement(
            "mypy API canary diagnostics differ from the CLI",
            details={
                "api_diagnostics": [asdict(item) for item in api_errors],
                "cli_diagnostics": [asdict(item) for item in cli_errors],
                "subprocess_status": process.returncode,
                "subprocess_stderr": stderr.decode(errors="replace"),
            },
        )
    result = {
        "complete": True,
        "any_origins": sorted(origins),
        "any_obligation_count": len(api_result.any_obligations),
        "unanchored_any_count": api_result.unanchored_any_count,
        "invalid_call_rejected": True,
        "api_cli_diagnostics_match": True,
        "cli_subprocess_status": process.returncode,
        "cli_stderr": stderr.decode(errors="replace"),
        "cli_elapsed_seconds": elapsed,
    }
    (output / "canaries" / "precision.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n"
    )
    return result


def _resolve_candidate_tree(repo: Path, reference: str) -> tuple[str, str]:
    tree = _tree_hash(repo, reference)
    try:
        commit = _run_git(repo, "rev-parse", "--verify", f"{reference}^{{commit}}").strip()
    except InvalidMeasurement:
        commit = tree
    return commit, tree


def _measure_profiles(source_changes: Sequence[str]) -> tuple[Profile, ...]:
    return (*_CORE_PROFILES, *((Profile.PRECISION,) if source_changes else ()))


def _command_baseline(repo: Path, output: Path) -> tuple[ExitCode, dict[str, object]]:
    revision, tree = resolve_tree(repo, "HEAD")
    precision_calibration = _run_precision_canaries(output)
    measurement = _measure_tree(repo, revision, tree, output, _CORE_PROFILES)
    complete = not measurement.gaps
    report: dict[str, object] = {
        "command": "baseline",
        "outcome": Outcome.COMPLETE.value if complete else Outcome.INVALID.value,
        "core_complete": complete,
        "precision_complete": False,
        "precision_status": "canaries calibrated; repository-wide precision not measured",
        "precision_calibration": precision_calibration,
        "tree_measurement": _tree_report(measurement),
    }
    if not complete:
        report["reasons"] = list(measurement.gaps)
        return ExitCode.INVALID, report
    return ExitCode.COMPLETE, report


def _command_compare(
    repo: Path,
    output: Path,
    *,
    command: str,
    parent_reference: str,
    candidate_reference: str,
) -> tuple[ExitCode, dict[str, object]]:
    parent_revision, parent_tree = resolve_tree(repo, parent_reference)
    candidate_revision, candidate_tree = _resolve_candidate_tree(repo, candidate_reference)
    _assert_trusted_policy(repo)
    changed_policy = _policy_changes(repo, parent_tree, candidate_tree)
    if changed_policy:
        reasons = ("candidate changes evaluator policy: " + ", ".join(changed_policy),)
        return ExitCode.REJECTED, {
            "command": command,
            "outcome": Outcome.REJECTED.value,
            "reasons": list(reasons),
            "adoption_credit": False,
            "core_complete": False,
            "precision_complete": False,
            "details": {"changed_evaluator_policy": list(changed_policy)},
            "parent_revision": parent_revision,
            "candidate_tree": candidate_tree,
        }
    source_changes = _changed_source_paths(repo, parent_tree, candidate_tree)
    precision_calibration = (
        _run_precision_canaries(output) if source_changes else None
    )
    profiles = _measure_profiles(source_changes)
    parent_measurement = _measure_tree(repo, parent_revision, parent_tree, output, profiles)
    if candidate_tree == parent_tree:
        candidate_measurement = parent_measurement
    else:
        reuse_allstrong = _candidate_allstrong_reuse_allowed(
            repo,
            parent_tree,
            candidate_tree,
            source_changes,
            parent_measurement,
        )
        candidate_measurement = _measure_tree(
            repo,
            candidate_revision,
            candidate_tree,
            output,
            profiles,
            reuse_from=parent_measurement if reuse_allstrong else None,
        )
    decision = decide_candidate(
        parent_measurement,
        candidate_measurement,
        require_adoption_credit=command == "evaluate",
        precision_calibrated=precision_calibration is not None,
    )
    report: dict[str, object] = {
        "command": command,
        "outcome": decision.outcome.value,
        "reasons": list(decision.reasons),
        "adoption_credit": decision.adoption_credit,
        "core_complete": decision.core_complete,
        "precision_complete": decision.precision_complete,
        "details": decision.details,
        "parent": _tree_report(parent_measurement),
        "candidate": _tree_report(candidate_measurement),
        "candidate_tree": candidate_tree,
        "source_changes": list(source_changes),
        "precision_calibration": precision_calibration,
    }
    exit_code = (
        ExitCode.COMPLETE
        if decision.outcome == Outcome.COMPLETE
        else ExitCode.INVALID
        if decision.outcome == Outcome.INVALID
        else ExitCode.REJECTED
    )
    return exit_code, report


def _command_terminal(repo: Path, output: Path) -> tuple[ExitCode, dict[str, object]]:
    revision, tree = resolve_tree(repo, "HEAD")
    precision_calibration = _run_precision_canaries(output)
    measurement = _measure_tree(repo, revision, tree, output, tuple(Profile))
    decision = decide_terminal(measurement, precision_calibrated=True)
    report: dict[str, object] = {
        "command": "terminal",
        "outcome": decision.outcome.value,
        "reasons": list(decision.reasons),
        "core_complete": decision.core_complete,
        "precision_complete": decision.precision_complete,
        "precision_calibration": precision_calibration,
        "details": decision.details,
        "tree_measurement": _tree_report(measurement),
    }
    return (
        ExitCode.COMPLETE
        if decision.outcome == Outcome.COMPLETE
        else ExitCode.INVALID
        if decision.outcome == Outcome.INVALID
        else ExitCode.REJECTED,
        report,
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m tools.mypy_helpers.typing_campaign")
    commands = parser.add_subparsers(dest="command", required=True)
    baseline = commands.add_parser("baseline")
    baseline.add_argument("--output", required=True)
    evaluate = commands.add_parser("evaluate")
    evaluate.add_argument("--parent", required=True)
    evaluate.add_argument("--candidate-tree", required=True)
    evaluate.add_argument("--output", required=True)
    guard = commands.add_parser("guard")
    guard.add_argument("--parent", required=True)
    guard.add_argument("--candidate-tree")
    guard.add_argument("--output", required=True)
    terminal = commands.add_parser("terminal")
    terminal.add_argument("--output", required=True)
    arguments = parser.parse_args(argv)

    output: Path | None = None
    try:
        output = _prepare_output(REPO_ROOT, arguments.output)
        if arguments.command == "baseline":
            exit_code, report = _command_baseline(REPO_ROOT, output)
        elif arguments.command in {"evaluate", "guard"}:
            candidate = arguments.candidate_tree or "HEAD^{tree}"
            exit_code, report = _command_compare(
                REPO_ROOT,
                output,
                command=arguments.command,
                parent_reference=arguments.parent,
                candidate_reference=candidate,
            )
        else:
            exit_code, report = _command_terminal(REPO_ROOT, output)
    except InvalidMeasurement as exc:
        report = {
            "command": arguments.command,
            "outcome": Outcome.INVALID.value,
            "reason": str(exc),
            "details": exc.details,
        }
        return_code = ExitCode.INVALID
        if output is not None:
            _write_report(output, report)
        else:
            print(json.dumps(_clean_json(report), sort_keys=True))
        print(f"invalid measurement: {exc}")
        return int(return_code)
    except Exception as exc:
        report = {
            "command": arguments.command,
            "outcome": Outcome.INVALID.value,
            "reason": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc(),
        }
        if output is not None:
            _write_report(output, report)
        else:
            print(json.dumps(_clean_json(report), sort_keys=True))
        print(f"invalid measurement: {type(exc).__name__}: {exc}")
        return int(ExitCode.INVALID)
    _write_report(output, report)
    print(f"{report['outcome']}: {output / 'report.json'}")
    return int(exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
