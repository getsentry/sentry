import os
from typing import MutableMapping

import pytest
from django.db import connections

from sentry.silo import SiloMode

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


_MODEL_MANIFEST_FILE_PATH = "./model-manifest.json"  # os.getenv("SENTRY_MODEL_MANIFEST_FILE_PATH")
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
def validate_silo_mode():
    # NOTE!  Hybrid cloud uses many mechanisms to simulate multiple different configurations of the application
    # during tests.  It depends upon `override_settings` using the correct contextmanager behaviors and correct
    # thread handling in acceptance tests.  If you hit one of these, it's possible either that cleanup logic has
    # a bug, or you may be using a contextmanager incorrectly.  Let us know and we can help!
    if SiloMode.get_current_mode() != SiloMode.MONOLITH:
        raise Exception(
            "Possible test leak bug!  SiloMode was not reset to Monolith between tests.  Please read the comment for validate_silo_mode() in tests/conftest.py."
        )
    yield
    if SiloMode.get_current_mode() != SiloMode.MONOLITH:
        raise Exception(
            "Possible test leak bug!  SiloMode was not reset to Monolith between tests.  Please read the comment for validate_silo_mode() in tests/conftest.py."
        )


@pytest.fixture(autouse=True)
def setup_simulate_on_commit(request):
    from sentry.testutils.hybrid_cloud import simulate_on_commit

    with simulate_on_commit(request):
        yield


@pytest.fixture(autouse=True)
def setup_enforce_monotonic_transactions(request):
    from sentry.testutils.hybrid_cloud import enforce_no_cross_transaction_interactions

    with enforce_no_cross_transaction_interactions():
        yield


@pytest.fixture(autouse=True)
def audit_hybrid_cloud_writes_and_deletes(request):
    """
    Ensure that write operations on hybrid cloud foreign keys are recorded
    alongside outboxes or use a context manager to indicate that the
    caller has considered outbox and didn't accidentally forget.

    Generally you can avoid assertion errors from these checks by:

    1. Running deletion/write logic within an `outbox_context`.
    2. Using Model.delete()/save methods that create outbox messages in the
       same transaction as a delete operation.

    Scenarios that are generally always unsafe are  using
    `QuerySet.delete()`, `QuerySet.update()` or raw SQL to perform
    writes.

    The User.delete() method is a good example of how to safely
    delete records and generate outbox messages.
    """
    from sentry.testutils.silo import validate_protected_queries

    debug_cursor_state: MutableMapping[str, bool] = {}
    for conn in connections.all():
        debug_cursor_state[conn.alias] = conn.force_debug_cursor

        conn.queries_log.clear()
        conn.force_debug_cursor = True

    try:
        yield
    finally:
        for conn in connections.all():
            conn.force_debug_cursor = debug_cursor_state[conn.alias]

            validate_protected_queries(conn.queries)
