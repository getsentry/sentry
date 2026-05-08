from __future__ import annotations

import importlib
import os
import sys
import textwrap
from pathlib import Path
from unittest import mock

import pytest


@pytest.fixture(autouse=True)
def _clean_proto_loader_state():
    """Reset proto dev loader state between tests."""
    import sentry.utils.proto_dev_loader as loader

    original_installed = loader._installed
    original_meta_path = sys.meta_path[:]

    # Remove any cached sentry_protos modules that we might create
    modules_to_remove = [k for k in sys.modules if k.startswith("sentry_protos.test_")]

    yield

    loader._installed = original_installed
    sys.meta_path[:] = original_meta_path

    for mod in modules_to_remove:
        sys.modules.pop(mod, None)
    # Also clean up anything our tests added
    for k in list(sys.modules):
        if k.startswith("sentry_protos.test_"):
            del sys.modules[k]


@pytest.fixture
def proto_dir(tmp_path: Path) -> Path:
    """Create a temporary proto source directory with a test .proto file."""
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


class TestGetProtoDevDirs:
    def test_returns_empty_when_nothing_configured(self, tmp_path: Path):
        from sentry.utils.proto_dev_loader import _get_proto_dev_dirs

        with mock.patch("sentry.utils.proto_dev_loader.LOCAL_PROTO_DIR", tmp_path / "nonexistent"):
            with mock.patch.dict(os.environ, {}, clear=True):
                dirs = _get_proto_dev_dirs()
                # May or may not include LOCAL_PROTO_DIR depending on repo state,
                # but the nonexistent dir should not appear
                assert (tmp_path / "nonexistent") not in dirs

    def test_includes_env_var_dir(self, proto_dir: Path):
        from sentry.utils.proto_dev_loader import _get_proto_dev_dirs

        with mock.patch("sentry.utils.proto_dev_loader.LOCAL_PROTO_DIR", Path("/nonexistent")):
            with mock.patch.dict(os.environ, {"SENTRY_PROTO_DEV_DIR": str(proto_dir)}):
                dirs = _get_proto_dev_dirs()
                assert proto_dir in dirs

    def test_local_dir_has_priority(self, proto_dir: Path, tmp_path: Path):
        from sentry.utils.proto_dev_loader import _get_proto_dev_dirs

        local_dir = tmp_path / "local_proto"
        local_dir.mkdir()

        with mock.patch("sentry.utils.proto_dev_loader.LOCAL_PROTO_DIR", local_dir):
            with mock.patch.dict(os.environ, {"SENTRY_PROTO_DEV_DIR": str(proto_dir)}):
                dirs = _get_proto_dev_dirs()
                assert dirs.index(local_dir) < dirs.index(proto_dir)


class TestFindProtoFile:
    def test_finds_proto_for_pb2_module(self, proto_dir: Path):
        from sentry.utils.proto_dev_loader import _find_proto_file

        result = _find_proto_file("sentry_protos.test_domain.v1.example_pb2", [proto_dir])
        assert result is not None
        assert result.name == "example.proto"

    def test_returns_none_for_missing_proto(self, proto_dir: Path):
        from sentry.utils.proto_dev_loader import _find_proto_file

        result = _find_proto_file("sentry_protos.test_domain.v1.nonexistent_pb2", [proto_dir])
        assert result is None

    def test_returns_none_for_non_pb2_module(self, proto_dir: Path):
        from sentry.utils.proto_dev_loader import _find_proto_file

        result = _find_proto_file("sentry_protos.test_domain.v1.example", [proto_dir])
        assert result is None

    def test_returns_none_for_grpc_module(self, proto_dir: Path):
        from sentry.utils.proto_dev_loader import _find_proto_file

        result = _find_proto_file("sentry_protos.test_domain.v1.example_pb2_grpc", [proto_dir])
        assert result is None

    def test_returns_none_for_non_sentry_protos(self, proto_dir: Path):
        from sentry.utils.proto_dev_loader import _find_proto_file

        result = _find_proto_file("other_package.foo_pb2", [proto_dir])
        assert result is None


class TestNeedsRecompile:
    def test_needs_recompile_when_cache_missing(self, proto_dir: Path, tmp_path: Path):
        from sentry.utils.proto_dev_loader import _needs_recompile

        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = tmp_path / "nonexistent.py"
        assert _needs_recompile(proto_file, cached) is True

    def test_no_recompile_when_cache_newer(self, proto_dir: Path, tmp_path: Path):
        from sentry.utils.proto_dev_loader import _needs_recompile

        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = tmp_path / "cached.py"
        cached.write_text("# cached")
        # Make cache newer
        os.utime(cached, (proto_file.stat().st_mtime + 10, proto_file.stat().st_mtime + 10))
        assert _needs_recompile(proto_file, cached) is False


class TestCompileProto:
    def test_compile_succeeds(self, proto_dir: Path, cache_dir: Path):
        pytest.importorskip("grpc_tools")
        from sentry.utils.proto_dev_loader import _compile_proto

        with mock.patch("sentry.utils.proto_dev_loader.CACHE_DIR", cache_dir):
            proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
            result = _compile_proto(proto_file, [proto_dir])
            assert result is True

            generated = cache_dir / "sentry_protos" / "test_domain" / "v1" / "example_pb2.py"
            assert generated.exists()

            # Check __init__.py files were created
            assert (cache_dir / "sentry_protos" / "__init__.py").exists()
            assert (cache_dir / "sentry_protos" / "test_domain" / "__init__.py").exists()
            assert (cache_dir / "sentry_protos" / "test_domain" / "v1" / "__init__.py").exists()

    def test_compile_fails_without_grpc_tools(self, proto_dir: Path, cache_dir: Path):
        from sentry.utils.proto_dev_loader import _compile_proto

        with mock.patch("sentry.utils.proto_dev_loader.CACHE_DIR", cache_dir):
            with mock.patch.dict(sys.modules, {"grpc_tools": None}):
                proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
                with pytest.raises(ImportError, match="grpcio-tools is required"):
                    _compile_proto(proto_file, [proto_dir])


class TestInstall:
    def test_install_returns_false_when_no_dirs(self):
        from sentry.utils.proto_dev_loader import install

        with mock.patch("sentry.utils.proto_dev_loader._get_proto_dev_dirs", return_value=[]):
            with mock.patch("sentry.utils.proto_dev_loader._installed", False):
                assert install() is False

    def test_install_adds_finder_to_meta_path(self, proto_dir: Path):
        import sentry.utils.proto_dev_loader as loader
        from sentry.utils.proto_dev_loader import _ProtoDevFinder, install

        with mock.patch.object(loader, "_installed", False):
            with mock.patch.object(loader, "_get_proto_dev_dirs", return_value=[proto_dir]):
                result = install()
                assert result is True
                assert any(isinstance(f, _ProtoDevFinder) for f in sys.meta_path)

    def test_install_is_idempotent(self, proto_dir: Path):
        import sentry.utils.proto_dev_loader as loader
        from sentry.utils.proto_dev_loader import _ProtoDevFinder, install

        with mock.patch.object(loader, "_installed", False):
            with mock.patch.object(loader, "_get_proto_dev_dirs", return_value=[proto_dir]):
                install()
                count_before = sum(1 for f in sys.meta_path if isinstance(f, _ProtoDevFinder))
                install()
                count_after = sum(1 for f in sys.meta_path if isinstance(f, _ProtoDevFinder))
                assert count_before == count_after


class TestEndToEnd:
    @pytest.mark.skipif(
        not importlib.util.find_spec("grpc_tools"),
        reason="grpcio-tools not installed",
    )
    def test_import_compiles_and_loads_proto(self, proto_dir: Path, cache_dir: Path):
        """Full end-to-end: install hook → import proto module → use message class."""
        import sentry.utils.proto_dev_loader as loader

        with mock.patch.object(loader, "LOCAL_PROTO_DIR", Path("/nonexistent")):
            with mock.patch.object(loader, "CACHE_DIR", cache_dir):
                with mock.patch.object(loader, "_installed", False):
                    with mock.patch.dict(os.environ, {"SENTRY_PROTO_DEV_DIR": str(proto_dir)}):
                        loader.install()

                        mod = importlib.import_module("sentry_protos.test_domain.v1.example_pb2")

                        assert hasattr(mod, "ExampleMessage")
                        assert hasattr(mod, "DESCRIPTOR")

                        msg = mod.ExampleMessage()
                        msg.name = "test"
                        msg.value = 42
                        assert msg.name == "test"
                        assert msg.value == 42

                        serialized = msg.SerializeToString()
                        msg2 = mod.ExampleMessage()
                        msg2.ParseFromString(serialized)
                        assert msg2.name == "test"
                        assert msg2.value == 42
