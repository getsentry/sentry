from __future__ import annotations

import importlib
import importlib.util
import os
import sys
import textwrap
from pathlib import Path
from unittest import mock

import pytest

from sentry.utils.proto_loader import (
    _cached_pb2_path,
    _get_dev_dirs,
    _get_override_dir,
    _pip_package_has,
    _ProtoFinder,
    install,
)


@pytest.fixture(autouse=True)
def _clean_proto_loader_state() -> None:
    """Reset proto loader state between tests."""
    import sentry.utils.proto_loader as loader

    original_installed = loader._installed
    original_meta_path = sys.meta_path[:]

    # Remove any globally-installed finders so tests can install their own.
    sys.meta_path[:] = [f for f in sys.meta_path if not isinstance(f, _ProtoFinder)]
    loader._installed = False

    yield

    loader._installed = original_installed
    sys.meta_path[:] = original_meta_path

    for k in list(sys.modules):
        if k.startswith("sentry_protos.test_"):
            del sys.modules[k]


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
        """)
    )
    return proto_root


@pytest.fixture
def override_dir(tmp_path: Path) -> Path:
    d = tmp_path / "override"
    d.mkdir()
    return d


class TestGetOverrideDir:
    def test_returns_env_var_path(self, tmp_path: Path) -> None:
        env_path = tmp_path / "custom_override"
        with mock.patch.dict(os.environ, {"SENTRY_PROTO_OVERRIDE_DIR": str(env_path)}):
            result = _get_override_dir()
            assert result == env_path.resolve()

    def test_returns_default_when_env_not_set(self) -> None:
        from sentry.utils.proto_loader import DEFAULT_OVERRIDE_DIR

        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SENTRY_PROTO_OVERRIDE_DIR", None)
            result = _get_override_dir()
            assert result == DEFAULT_OVERRIDE_DIR


class TestGetDevDirs:
    def test_returns_empty_when_nothing_configured(self, tmp_path: Path) -> None:
        with mock.patch("sentry.utils.proto_loader.LOCAL_PROTO_DIR", tmp_path / "nonexistent"):
            with mock.patch.dict(os.environ, {}, clear=False):
                os.environ.pop("SENTRY_PROTO_DEV_DIR", None)
                dirs = _get_dev_dirs()
                assert (tmp_path / "nonexistent") not in dirs

    def test_includes_env_var_dir(self, proto_dir: Path) -> None:
        with mock.patch("sentry.utils.proto_loader.LOCAL_PROTO_DIR", Path("/nonexistent")):
            with mock.patch.dict(os.environ, {"SENTRY_PROTO_DEV_DIR": str(proto_dir)}):
                dirs = _get_dev_dirs()
                assert proto_dir.resolve() in dirs

    def test_includes_local_dir_if_exists(self, tmp_path: Path) -> None:
        local_dir = tmp_path / "local_proto"
        local_dir.mkdir()
        with mock.patch("sentry.utils.proto_loader.LOCAL_PROTO_DIR", local_dir):
            with mock.patch.dict(os.environ, {}, clear=False):
                os.environ.pop("SENTRY_PROTO_DEV_DIR", None)
                dirs = _get_dev_dirs()
                assert local_dir in dirs

    def test_local_dir_has_priority_over_env_dir(self, proto_dir: Path, tmp_path: Path) -> None:
        local_dir = tmp_path / "local_proto"
        local_dir.mkdir()
        with mock.patch("sentry.utils.proto_loader.LOCAL_PROTO_DIR", local_dir):
            with mock.patch.dict(os.environ, {"SENTRY_PROTO_DEV_DIR": str(proto_dir)}):
                dirs = _get_dev_dirs()
                assert dirs.index(local_dir) < dirs.index(proto_dir.resolve())


class TestCachedPb2Path:
    def test_maps_module_to_file_path(self, override_dir: Path) -> None:
        result = _cached_pb2_path("sentry_protos.billing.v1.data_category_pb2", override_dir)
        expected = override_dir / "sentry_protos" / "billing" / "v1" / "data_category_pb2.py"
        assert result == expected

    def test_handles_deeply_nested_module(self, override_dir: Path) -> None:
        result = _cached_pb2_path("sentry_protos.a.b.c.d_pb2", override_dir)
        expected = override_dir / "sentry_protos" / "a" / "b" / "c" / "d_pb2.py"
        assert result == expected


class TestPipPackageHas:
    def test_returns_true_for_existing_package(self) -> None:
        sp = sys.modules.get("sentry_protos")
        if sp is None:
            pytest.skip("sentry_protos not installed")
        pip_file = getattr(sp, "__file__", None)
        if pip_file is None:
            pytest.skip("sentry_protos has no __file__")
        pip_root = Path(pip_file).parent
        subdirs = [d.name for d in pip_root.iterdir() if d.is_dir() and not d.name.startswith("_")]
        if not subdirs:
            pytest.skip("sentry_protos has no sub-packages")
        assert _pip_package_has(f"sentry_protos.{subdirs[0]}") is True

    def test_returns_false_for_nonexistent_package(self) -> None:
        assert _pip_package_has("sentry_protos.nonexistent_domain_xyz") is False

    def test_handles_missing_sentry_protos(self) -> None:
        with mock.patch.dict(sys.modules, {"sentry_protos": None}):
            with mock.patch("importlib.util.find_spec", side_effect=ModuleNotFoundError):
                assert _pip_package_has("sentry_protos.anything") is False


class TestProtoFinder:
    def test_returns_spec_for_pb2_when_cached_exists(self, override_dir: Path):
        pb2_dir = override_dir / "sentry_protos" / "test_domain" / "v1"
        pb2_dir.mkdir(parents=True)
        pb2_file = pb2_dir / "example_pb2.py"
        pb2_file.write_text("# generated")

        finder = _ProtoFinder(override_dir=override_dir)
        spec = finder.find_spec("sentry_protos.test_domain.v1.example_pb2")
        assert spec is not None
        assert spec.name == "sentry_protos.test_domain.v1.example_pb2"

    def test_returns_none_for_pb2_when_no_cached_file(self, override_dir: Path):
        finder = _ProtoFinder(override_dir=override_dir)
        spec = finder.find_spec("sentry_protos.test_domain.v1.missing_pb2")
        assert spec is None

    def test_returns_none_for_non_sentry_protos(self, override_dir: Path) -> None:
        finder = _ProtoFinder(override_dir=override_dir)
        spec = finder.find_spec("other_package.foo_pb2")
        assert spec is None

    def test_returns_none_for_pb2_grpc(self, override_dir: Path):
        finder = _ProtoFinder(override_dir=override_dir)
        spec = finder.find_spec("sentry_protos.test_domain.v1.example_pb2_grpc")
        assert spec is None

    def test_handles_intermediate_packages_for_new_domains(self, override_dir: Path) -> None:
        new_domain = override_dir / "sentry_protos" / "new_domain"
        new_domain.mkdir(parents=True)

        finder = _ProtoFinder(override_dir=override_dir)
        with mock.patch("sentry.utils.proto_loader._pip_package_has", return_value=False):
            spec = finder.find_spec("sentry_protos.new_domain")
            assert spec is not None

    def test_returns_none_for_intermediate_packages_in_pip(self, override_dir: Path) -> None:
        existing_domain = override_dir / "sentry_protos" / "snuba"
        existing_domain.mkdir(parents=True)

        finder = _ProtoFinder(override_dir=override_dir)
        with mock.patch("sentry.utils.proto_loader._pip_package_has", return_value=True):
            spec = finder.find_spec("sentry_protos.snuba")
            assert spec is None


class TestNoShadowing:
    def test_pip_pb2_still_importable_when_override_has_partial_files(self, override_dir: Path):
        snuba_dir = override_dir / "sentry_protos" / "snuba" / "v1"
        snuba_dir.mkdir(parents=True)
        (snuba_dir / "custom_pb2.py").write_text("# local override")

        finder = _ProtoFinder(override_dir=override_dir)

        with mock.patch("sentry.utils.proto_loader._pip_package_has", return_value=True):
            spec = finder.find_spec("sentry_protos.snuba")
            assert spec is None, "Finder must NOT claim intermediate packages that pip already has"

            spec = finder.find_spec("sentry_protos.snuba.v1")
            assert spec is None, "Finder must NOT claim sub-packages that pip already has"

    def test_finder_claims_new_domain_not_in_pip(self, override_dir: Path) -> None:
        brand_new = override_dir / "sentry_protos" / "brand_new_domain"
        brand_new.mkdir(parents=True)

        finder = _ProtoFinder(override_dir=override_dir)
        with mock.patch("sentry.utils.proto_loader._pip_package_has", return_value=False):
            spec = finder.find_spec("sentry_protos.brand_new_domain")
            assert spec is not None, "Finder should claim new domains not in pip"


class TestDevMode:
    def test_compiles_when_proto_source_newer(self, proto_dir: Path, override_dir: Path) -> None:
        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = override_dir / "sentry_protos" / "test_domain" / "v1" / "example_pb2.py"
        cached.parent.mkdir(parents=True)
        cached.write_text("# stale")
        os.utime(cached, (proto_file.stat().st_mtime - 10, proto_file.stat().st_mtime - 10))

        finder = _ProtoFinder(override_dir=override_dir, dev_dirs=[proto_dir])

        with (
            mock.patch("sentry.utils.proto_compiler.compile_proto") as mock_compile,
            mock.patch("sentry.utils.proto_compiler.find_proto_file", return_value=proto_file),
            mock.patch("sentry.utils.proto_compiler.needs_recompile", return_value=True),
        ):
            finder.find_spec("sentry_protos.test_domain.v1.example_pb2")
            mock_compile.assert_called_once_with(proto_file, [proto_dir], override_dir)

    def test_no_compile_when_cache_up_to_date(self, proto_dir: Path, override_dir: Path) -> None:
        proto_file = proto_dir / "sentry_protos" / "test_domain" / "v1" / "example.proto"
        cached = override_dir / "sentry_protos" / "test_domain" / "v1" / "example_pb2.py"
        cached.parent.mkdir(parents=True)
        cached.write_text("# fresh")
        os.utime(cached, (proto_file.stat().st_mtime + 10, proto_file.stat().st_mtime + 10))

        finder = _ProtoFinder(override_dir=override_dir, dev_dirs=[proto_dir])

        with (
            mock.patch("sentry.utils.proto_compiler.compile_proto") as mock_compile,
            mock.patch("sentry.utils.proto_compiler.find_proto_file", return_value=proto_file),
            mock.patch("sentry.utils.proto_compiler.needs_recompile", return_value=False),
        ):
            finder.find_spec("sentry_protos.test_domain.v1.example_pb2")
            mock_compile.assert_not_called()

    def test_no_compile_in_prod_mode(self, override_dir: Path) -> None:
        finder = _ProtoFinder(override_dir=override_dir, dev_dirs=[])

        with mock.patch("sentry.utils.proto_compiler.compile_proto") as mock_compile:
            finder.find_spec("sentry_protos.test_domain.v1.example_pb2")
            mock_compile.assert_not_called()


class TestInstall:
    def test_returns_false_when_no_dirs(self, tmp_path: Path) -> None:
        import sentry.utils.proto_loader as loader

        with mock.patch.object(loader, "_installed", False):
            with mock.patch.object(
                loader, "_get_override_dir", return_value=tmp_path / "nonexistent"
            ):
                with mock.patch.object(loader, "_get_dev_dirs", return_value=[]):
                    assert install() is False

    def test_returns_true_and_adds_finder(self, override_dir: Path) -> None:
        import sentry.utils.proto_loader as loader

        with mock.patch.object(loader, "_installed", False):
            with mock.patch.object(loader, "_get_override_dir", return_value=override_dir):
                with mock.patch.object(loader, "_get_dev_dirs", return_value=[]):
                    result = install()
                    assert result is True
                    assert any(isinstance(f, _ProtoFinder) for f in sys.meta_path)

    def test_idempotent(self, override_dir: Path) -> None:
        import sentry.utils.proto_loader as loader

        with mock.patch.object(loader, "_installed", False):
            with mock.patch.object(loader, "_get_override_dir", return_value=override_dir):
                with mock.patch.object(loader, "_get_dev_dirs", return_value=[]):
                    install()
                    count_before = sum(1 for f in sys.meta_path if isinstance(f, _ProtoFinder))
                    install()
                    count_after = sum(1 for f in sys.meta_path if isinstance(f, _ProtoFinder))
                    assert count_before == count_after


class TestEndToEnd:
    @pytest.mark.skipif(
        not importlib.util.find_spec("grpc_tools"),
        reason="grpcio-tools not installed",
    )
    def test_import_compiles_and_loads_proto(self, proto_dir: Path, override_dir: Path) -> None:
        import sentry.utils.proto_loader as loader

        with mock.patch.object(loader, "LOCAL_PROTO_DIR", Path("/nonexistent")):
            with mock.patch.object(loader, "DEFAULT_OVERRIDE_DIR", override_dir):
                with mock.patch.object(loader, "_installed", False):
                    with mock.patch.dict(os.environ, {"SENTRY_PROTO_DEV_DIR": str(proto_dir)}):
                        os.environ.pop("SENTRY_PROTO_OVERRIDE_DIR", None)
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
