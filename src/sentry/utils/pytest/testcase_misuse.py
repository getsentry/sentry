import inspect

import pytest

# Ensure that testcases that ask for DB setup actually make use of the
# DB. If they don't, they're wasting CI time.
#
# Only works for class-based tests


@pytest.fixture(autouse=True, scope="class")
def _require_db_usage(request):
    from rest_framework.test import APITestCase

    if (
        request.cls is None
        or "django_db" not in {mark.name for mark in request.node.iter_markers()}
        or issubclass(request.cls, APITestCase)
    ):
        yield
        return

    class State:
        used_db = {}
        base = request.cls

    state = State()

    yield state

    did_not_use = set()
    did_use = set()
    for name, used in state.used_db.items():
        if used:
            did_use.add(name)
        else:
            did_not_use.add(name)

    if did_not_use and not did_use:
        pytest.fail(
            f"none of the test functions in {state.base} used the DB! Use `unittest.TestCase` "
            f"instead of `sentry.testutils.TestCase` for those kinds of tests"
        )
    elif did_not_use and did_use:
        pytest.fail(
            f"Some of the test functions in {state.base} used the DB and some did not! "
            f"test functions using the db: {did_use}\n"
            f"Use `unittest.TestCase` instead of `sentry.testutils.TestCase` for the tests not using the db."
        )


@pytest.fixture(autouse=True, scope="function")
def _check_function_for_db(request, monkeypatch, _require_db_usage):
    if _require_db_usage is None:
        return

    from django.db.backends.base.base import BaseDatabaseWrapper

    real_ensure_connection = BaseDatabaseWrapper.ensure_connection

    state = _require_db_usage

    def ensure_connection(*args, **kwargs):
        for info in inspect.stack():
            frame = info.frame
            try:
                first_arg_name = frame.f_code.co_varnames[0]
                first_arg = frame.f_locals[first_arg_name]
            except LookupError:
                continue

            # make an exact check here for two reasons.  One is that this is
            # good enough as we do not expect subclasses, secondly however because
            # it turns out doing an isinstance check on untrusted input can cause
            # bad things to happen because it's hookable.  In particular this
            # blows through max recursion limits here if it encounters certain
            # types of broken lazy proxy objects.
            if type(first_arg) is state.base and info.function in state.used_db:
                state.used_db[info.function] = True
                break

        return real_ensure_connection(*args, **kwargs)

    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", ensure_connection)
    state.used_db[request.function.__name__] = False
