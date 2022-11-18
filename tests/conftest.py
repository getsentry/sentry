import contextlib
import os

import pytest

pytest_plugins = ["sentry.utils.pytest"]


# XXX: The below code is vendored code from https://github.com/utgwkk/pytest-github-actions-annotate-failures
# so that we can add support for pytest_rerunfailures
# retried tests will no longer be annotated in GHA
#
# Reference:
# https://docs.pytest.org/en/latest/writing_plugins.html#hookwrapper-executing-around-other-hooks
# https://docs.pytest.org/en/latest/writing_plugins.html#hook-function-ordering-call-example
# https://docs.pytest.org/en/stable/reference.html#pytest.hookspec.pytest_runtest_makereport
#
# Inspired by:
# https://github.com/pytest-dev/pytest/blob/master/src/_pytest/terminal.py


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # execute all other hooks to obtain the report object
    outcome = yield
    report = outcome.get_result()

    # enable only in a workflow of GitHub Actions
    # ref: https://help.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return

    # If we have the pytest_rerunfailures plugin,
    # and there are still retries to be run,
    # then do not return the error
    if hasattr(item, "execution_count"):
        import pytest_rerunfailures

        if item.execution_count <= pytest_rerunfailures.get_reruns_count(item):
            return

    if report.when == "call" and report.failed:
        # collect information to be annotated
        filesystempath, lineno, _ = report.location

        # try to convert to absolute path in GitHub Actions
        workspace = os.environ.get("GITHUB_WORKSPACE")
        if workspace:
            full_path = os.path.abspath(filesystempath)
            try:
                rel_path = os.path.relpath(full_path, workspace)
            except ValueError:
                # os.path.relpath() will raise ValueError on Windows
                # when full_path and workspace have different mount points.
                # https://github.com/utgwkk/pytest-github-actions-annotate-failures/issues/20
                rel_path = filesystempath
            if not rel_path.startswith(".."):
                filesystempath = rel_path

        if lineno is not None:
            # 0-index to 1-index
            lineno += 1

        # get the name of the current failed test, with parametrize info
        longrepr = report.head_line or item.name

        # get the error message and line number from the actual error
        try:
            longrepr += "\n\n" + report.longrepr.reprcrash.message
            lineno = report.longrepr.reprcrash.lineno
        except AttributeError:
            pass

        print(_error_workflow_command(filesystempath, lineno, longrepr))  # noqa: S002


def _error_workflow_command(filesystempath, lineno, longrepr):
    # Build collection of arguments. Ordering is strict for easy testing
    details_dict = {"file": filesystempath}
    if lineno is not None:
        details_dict["line"] = lineno

    details = ",".join(f"{k}={v}" for k, v in details_dict.items())

    if longrepr is None:
        return f"\n::error {details}"
    else:
        longrepr = _escape(longrepr)
        return f"\n::error {details}::{longrepr}"


def _escape(s):
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


_MODEL_MANIFEST_FILE_PATH = os.getenv("SENTRY_MODEL_MANIFEST_FILE_PATH")
_model_manifest = None


@pytest.fixture(scope="session", autouse=True)
def create_model_manifest_file():
    """Audit which models are touched by each test case and write it to file."""

    # We have to construct the ModelManifest lazily, because importing
    # sentry.testutils.modelmanifest too early causes a dependency cycle.
    from sentry.testutils.modelmanifest import ModelManifest

    if _MODEL_MANIFEST_FILE_PATH:
        global _model_manifest
        _model_manifest = ModelManifest.open(_MODEL_MANIFEST_FILE_PATH)
        with _model_manifest.write():
            yield
    else:
        yield


@pytest.fixture(scope="class", autouse=True)
def register_class_in_model_manifest(request: pytest.FixtureRequest):
    if _model_manifest:
        with _model_manifest.register(request.node.nodeid):
            yield
    else:
        yield


@pytest.fixture(autouse=True)
def setup_default_hybrid_cloud_stubs():
    from sentry.region_to_control.producer import (
        MockRegionToControlMessageService,
        region_to_control_message_service,
    )
    from sentry.silo import SiloMode
    from sentry.testutils.hybrid_cloud import service_stubbed

    stubs = [
        service_stubbed(
            region_to_control_message_service, MockRegionToControlMessageService(), SiloMode.REGION
        ),
    ]

    with contextlib.ExitStack() as stack:
        for stub in stubs:
            stack.enter_context(stub)
        yield
