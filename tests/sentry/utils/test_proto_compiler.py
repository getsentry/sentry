from __future__ import annotations

import os
import textwrap
from pathlib import Path
from unittest import mock

import pytest

from sentry.utils.proto_compiler import (
    _ensure_init_files,
    clear_cache,
    compile_all,
    compile_proto,
    find_proto_file,
    main,
    needs_recompile,
)


@pytest.fixture
def proto_dir(tmp_path: Path) -> Path:
    proto_root = tmp_path / "proto"
    proto_pkg = proto_root / "sentry_protos" / "test_domain" / "v1"
    proto_pkg.mkdir(parents=True)

    proto_file = proto_pkg / "example.proto"
    proto_file.write_text(
        textwrap.dedent("""\
        syntax = "proto3";
        package sentry_protos.test_domain.v1;

        message ExampleMessage {
            string name = 1;
            int32 value = 2;
        }

        enum ExampleEnum {
            EXAMPLE_ENUM_UNSPECIFIED = 0;
            EXAMPLE_ENUM_ACTIVE = 1;
        }
        """)
    )
    return proto_root


@pytest.fixture
def cache_dir(tmp_path: Path) -> Path:
    return tmp_path / "cache"


class TestNeedsRecompile:
    def test_returns_true_when_cache_missing(self, proto_dir: Path, tmp_path: Path) -> None:
        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = tmp_path / "nonexistent.py"
        assert needs_recompile(proto_file, cached) is True

    def test_returns_true_when_proto_newer(self, proto_dir: Path, tmp_path: Path) -> None:
        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = tmp_path / "cached.py"
        cached.write_text("# cached")
        os.utime(cached, (proto_file.stat().st_mtime - 10, proto_file.stat().st_mtime - 10))
        assert needs_recompile(proto_file, cached) is True

    def test_returns_false_when_cache_newer(self, proto_dir: Path, tmp_path: Path) -> None:
        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = tmp_path / "cached.py"
        cached.write_text("# cached")
        os.utime(cached, (proto_file.stat().st_mtime + 10, proto_file.stat().st_mtime + 10))
        assert needs_recompile(proto_file, cached) is False

    def test_returns_false_when_same_mtime(self, proto_dir: Path, tmp_path: Path) -> None:
        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = tmp_path / "cached.py"
        cached.write_text("# cached")
        mtime = proto_file.stat().st_mtime
        os.utime(cached, (mtime, mtime))
        assert needs_recompile(proto_file, cached) is False

    def test_returns_true_on_oserror(self, tmp_path: Path) -> None:
        proto_file = tmp_path / "missing.proto"
        cached = tmp_path / "cached.py"
        cached.write_text("# cached")
        assert needs_recompile(proto_file, cached) is True


class TestFindProtoFile:
    def test_finds_proto_for_pb2_module(self, proto_dir: Path):
        result = find_proto_file("sentry_protos.test_domain.v1.example_pb2", [proto_dir])
        assert result is not None
        assert result.name == "example.proto"

    def test_returns_none_for_missing_proto(self, proto_dir: Path) -> None:
        result = find_proto_file("sentry_protos.test_domain.v1.nonexistent_pb2", [proto_dir])
        assert result is None

    def test_returns_none_for_non_pb2_module(self, proto_dir: Path):
        result = find_proto_file("sentry_protos.test_domain.v1.example", [proto_dir])
        assert result is None

    def test_returns_none_for_grpc_module(self, proto_dir: Path) -> None:
        result = find_proto_file("sentry_protos.test_domain.v1.example_pb2_grpc", [proto_dir])
        assert result is None

    def test_returns_none_for_non_sentry_protos(self, proto_dir: Path) -> None:
        result = find_proto_file("other_package.foo_pb2", [proto_dir])
        assert result is None

    def test_returns_none_for_single_part_module(self, proto_dir: Path) -> None:
        result = find_proto_file("sentry_protos", [proto_dir])
        assert result is None

    def test_searches_multiple_dirs(self, tmp_path: Path) -> None:
        dir1 = tmp_path / "dir1"
        dir2 = tmp_path / "dir2"
        pkg = dir2 / "sentry_protos" / "other" / "v1"
        pkg.mkdir(parents=True)
        (pkg / "thing.proto").write_text('syntax = "proto3";')

        result = find_proto_file("sentry_protos.other.v1.thing_pb2", [dir1, dir2])
        assert result is not None
        assert result.name == "thing.proto"


class TestEnsureInitFiles:
    def test_creates_init_chain(self, tmp_path: Path) -> None:
        root = tmp_path / "output"
        root.mkdir()
        target = root / "a" / "b" / "c"
        target.mkdir(parents=True)

        _ensure_init_files(target, root)

        assert (root / "a" / "__init__.py").exists()
        assert (root / "a" / "b" / "__init__.py").exists()
        assert (root / "a" / "b" / "c" / "__init__.py").exists()

    def test_does_not_overwrite_existing_init(self, tmp_path: Path) -> None:
        root = tmp_path / "output"
        target = root / "pkg"
        target.mkdir(parents=True)
        init = target / "__init__.py"
        init.write_text("# existing content")

        _ensure_init_files(target, root)

        assert init.read_text() == "# existing content"


class TestCompileProto:
    def test_compile_succeeds(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        result = compile_proto(proto_file, [proto_dir], cache_dir)
        assert result is True

        generated = cache_dir / "sentry_protos" / "test_domain" / "v1" / "example_pb2.py"
        assert generated.exists()

        assert (cache_dir / "sentry_protos" / "__init__.py").exists()
        assert (cache_dir / "sentry_protos" / "test_domain" / "__init__.py").exists()
        assert (cache_dir / "sentry_protos" / "test_domain" / "v1" / "__init__.py").exists()

    def test_raises_without_grpc_tools(self, proto_dir: Path, cache_dir: Path) -> None:
        with mock.patch.dict("sys.modules", {"grpc_tools": None}):
            proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
            with pytest.raises(ImportError, match="grpcio-tools is required"):
                compile_proto(proto_file, [proto_dir], cache_dir)

    def test_returns_false_when_proto_not_under_include_path(
        self, tmp_path: Path, cache_dir: Path
    ) -> None:
        pytest.importorskip("grpc_tools")

        stray = tmp_path / "stray" / "example.proto"
        stray.parent.mkdir(parents=True)
        stray.write_text('syntax = "proto3";')

        other_dir = tmp_path / "other_includes"
        other_dir.mkdir()

        result = compile_proto(stray, [other_dir], cache_dir)
        assert result is False

    def test_returns_false_on_protoc_failure(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        bad_proto = proto_dir / "sentry_protos" / "test_domain" / "v1" / "bad.proto"
        bad_proto.write_text("this is not valid proto syntax!!!")

        result = compile_proto(bad_proto, [proto_dir], cache_dir)
        assert result is False


class TestCompileAll:
    def test_compiles_all_protos(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        compiled, skipped, failed = compile_all([proto_dir], cache_dir)
        assert compiled == 1
        assert skipped == 0
        assert failed == 0

        generated = cache_dir / "sentry_protos" / "test_domain" / "v1" / "example_pb2.py"
        assert generated.exists()

    def test_skips_when_cache_is_fresh(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        compile_all([proto_dir], cache_dir)

        compiled, skipped, failed = compile_all([proto_dir], cache_dir)
        assert compiled == 0
        assert skipped == 1
        assert failed == 0

    def test_force_recompiles_fresh_cache(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        compile_all([proto_dir], cache_dir)

        compiled, skipped, failed = compile_all([proto_dir], cache_dir, force=True)
        assert compiled == 1
        assert skipped == 0
        assert failed == 0

    def test_counts_failures(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        bad_proto = proto_dir / "sentry_protos" / "test_domain" / "v1" / "bad.proto"
        bad_proto.write_text("not valid proto")

        compiled, skipped, failed = compile_all([proto_dir], cache_dir)
        assert compiled == 1
        assert failed == 1

    def test_handles_empty_dir(self, tmp_path: Path, cache_dir: Path) -> None:
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        compiled, skipped, failed = compile_all([empty_dir], cache_dir)
        assert compiled == 0
        assert skipped == 0
        assert failed == 0


class TestClearCache:
    def test_removes_existing_cache(self, cache_dir: Path) -> None:
        cache_dir.mkdir(parents=True)
        (cache_dir / "some_file.py").write_text("# generated")

        clear_cache(cache_dir)
        assert not cache_dir.exists()

    def test_noop_when_cache_missing(self, cache_dir: Path) -> None:
        assert not cache_dir.exists()
        clear_cache(cache_dir)
        assert not cache_dir.exists()


class TestCLI:
    def test_compile_command(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        exit_code = main(["compile", "--source", str(proto_dir), "--output", str(cache_dir)])
        assert exit_code == 0

        generated = cache_dir / "sentry_protos" / "test_domain" / "v1" / "example_pb2.py"
        assert generated.exists()

    def test_compile_with_force(self, proto_dir: Path, cache_dir: Path) -> None:
        pytest.importorskip("grpc_tools")

        main(["compile", "--source", str(proto_dir), "--output", str(cache_dir)])
        exit_code = main(
            ["compile", "--source", str(proto_dir), "--output", str(cache_dir), "--force"]
        )
        assert exit_code == 0

    def test_compile_returns_1_on_failure(self, proto_dir: Path, cache_dir: Path):
        pytest.importorskip("grpc_tools")

        bad_proto = proto_dir / "sentry_protos" / "test_domain" / "v1" / "bad.proto"
        bad_proto.write_text("not valid proto")

        exit_code = main(["compile", "--source", str(proto_dir), "--output", str(cache_dir)])
        assert exit_code == 1

    def test_compile_multiple_sources(
        self, proto_dir: Path, tmp_path: Path, cache_dir: Path
    ) -> None:
        pytest.importorskip("grpc_tools")

        extra_dir = tmp_path / "extra"
        extra_dir.mkdir()

        exit_code = main(
            [
                "compile",
                "--source",
                str(proto_dir),
                "--source",
                str(extra_dir),
                "--output",
                str(cache_dir),
            ]
        )
        assert exit_code == 0

    def test_clear_command(self, cache_dir: Path) -> None:
        cache_dir.mkdir(parents=True)
        (cache_dir / "generated.py").write_text("# cached")

        exit_code = main(["clear", "--output", str(cache_dir)])
        assert exit_code == 0
        assert not cache_dir.exists()

    def test_no_command_raises(self) -> None:
        with pytest.raises(SystemExit):
            main([])
