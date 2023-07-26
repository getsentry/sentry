"""
This testsuite is written in a way where it is pretty safe to check in
real-world stacktraces as fixtures. This only works because the testsuite
itself aggressively removes all data not relevant for the test.

Here we only test enhancement rules that apply a category to frames, everything
else like actual grouping happens elsewhere like test_variants.py.

1. Put your real-world event into tests/sentry/grouping/categorization_inputs/.
   It needs to have a normalized exception interface. Threads are ignored and need
   to be converted to exceptions somehow. Chained exceptions are fine.

2. Run testsuite. The first time it will generate insta-snapshot files that you
   can review for categorization. Use `SENTRY_SNAPSHOTS_WRITEBACK=new` and `make
   review-python-snapshots` as usual. At this point your snapshots are full of
   PII. Iterate on enhancement rules to give more and more frames a category.

   Ignore the test failure about deleting useless data for now.

3. Re-run testsuite with SENTRY_TEST_GROUPING_DELETE_USELESS_DATA=1 to delete
   all unannotated frames from the original test fixtures, then re-run the
   testsuite again with SENTRY_SNAPSHOTS_WRITEBACK=1 to also update the snapshot
   files accordingly. This gets rid of 99% of sensitive data, as unused event
   attributes such as user context is deleted, and all frames without category
   must be application code that we can't use for writing global enhancements,
   so they can be removed/stubbed as well.

   This step also removes a lot of test fixtures that do not exercize
   additional code, meaning you can review 500 events (if you have time to do
   that) and still only end up pushing 20 into master.

4. Manually remove PII.

   It can be that there are "standard library" frames with a category that are
   statically linked into the application DLL, meaning that there are still
   frames that have PII in their filepaths.

   Also the exception type/value is not automatically scrubbed, as it can
   provide useful context. Scrub that manually too.

5. Squash your commits into one and push.

   If you push any intermediate step into master or even just a PR, you just
   leaked PII to the public and all of this will have been for nothing.
"""
from __future__ import annotations

import contextlib
import json  # NOQA
import os
import uuid
from unittest import mock

import pytest
from django.utils.functional import cached_property

from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.grouping.enhancer.actions import VarAction
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.utils.safe import get_path

_fixture_path = os.path.join(os.path.dirname(__file__), "categorization_inputs")

_SHOULD_DELETE_DATA = os.environ.get("SENTRY_TEST_GROUPING_DELETE_USELESS_DATA") == "1"
_DELETE_KEYWORDS = [
    x for x in os.environ.get("SENTRY_TEST_GROUPING_DELETE_KEYWORDS", "").lower().split(",") if x
]


class CategorizationInput:
    def __init__(self, filename):
        self.filename = filename

    @cached_property
    def data(self):
        with open(os.path.join(_fixture_path, self.filename)) as f:
            return _pre_scrub_event(json.load(f))


CONFIG = load_grouping_config(get_default_grouping_config_dict("mobile:2021-02-12"))


def get_stacktrace_render(data):
    """
    Platform agnostic stacktrace renderer with annotations
    """
    rv = []
    for exc in get_path(data, "exception", "values", filter=True) or ():
        ty = get_path(exc, "type") or "_"
        value = get_path(exc, "value") or "_"
        thread_id = get_path(exc, "id") or "_"
        crashed = get_path(exc, "crashed", default="_")
        rv.append("")
        rv.append("")
        rv.append(f"{ty}:{value} (thread_id:{thread_id}, crashed:{crashed})")

        for frame in get_path(exc, "stacktrace", "frames", filter=True) or ():
            module = (
                get_path(frame, "package")
                or get_path(frame, "module")
                or get_path(frame, "filename")
                or get_path(frame, "abs_path")
                or ""
            )[:42].rjust(42)
            function = get_path(frame, "function") or "???"

            category = get_path(frame, "data", "category") or ""
            if category:
                category = f"category={category}"

            rv.append(f"  {module}  {function} {category}".rstrip())

    return "\n".join(rv)


INPUTS = [
    CategorizationInput(fname) for fname in os.listdir(_fixture_path) if fname.endswith(".json")
]


@pytest.mark.parametrize("input", INPUTS, ids=lambda x: x.filename[:-5].replace("-", "_"))
def test_categorization(input: CategorizationInput, insta_snapshot, track_enhancers_coverage):
    # XXX: In-process re-runs using pytest-watch or whatever will behave
    # wrongly because input.data is reused between tests, we do this for perf.
    data = input.data
    with track_enhancers_coverage(input):
        normalize_stacktraces_for_grouping(data, CONFIG)

    insta_snapshot(get_stacktrace_render(data))


@pytest.fixture(scope="session", autouse=True)
def track_enhancers_coverage():
    old_apply = VarAction.apply_modifications_to_frame

    used_inputs: dict[str, list[CategorizationInput]] = {}

    current_input: CategorizationInput | None = None

    def new_apply(self, frames, match_frames, idx, rule=None):
        if current_input is not None:
            inputs_for_rule = used_inputs.setdefault(rule.matcher_description, [])

            # Tolerate up to four testcases per rule. This number is arbitrary but
            # the idea is that after matching a system frame for the hundreth time,
            # nothing is really tested anymore.
            if len(inputs_for_rule) < 4:
                inputs_for_rule.append(current_input)

        return old_apply(self, frames, match_frames, idx, rule=rule)

    ran_tests = {}

    @contextlib.contextmanager
    def inner(input):
        ran_tests[input.filename] = True
        nonlocal current_input
        # if this assertion is ever hit because we dare to multithread tests in
        # some way, current_input can be changed to a thread-local
        assert current_input is None, "context manager does not support multithreading"
        current_input = input

        with mock.patch.object(VarAction, "apply_modifications_to_frame", new_apply):
            try:
                yield
            finally:
                current_input = None

    yield inner

    if not all(ran_tests.get(input.filename) for input in INPUTS):
        # need to run entire test_categorization for this test to run
        return

    all_filenames = {i.filename for i in INPUTS}
    used_filenames = {i.filename for inputs in used_inputs.values() for i in inputs}
    delete_filenames = all_filenames - used_filenames

    if delete_filenames:
        if _SHOULD_DELETE_DATA:
            for filename in delete_filenames:
                os.remove(os.path.join(_fixture_path, filename))
        else:
            raise AssertionError(
                f"{len(delete_filenames)} test payloads found that do not exercize additional rules. Commit your changes and run with envvar SENTRY_TEST_GROUPING_DELETE_USELESS_DATA=1"
            )

    all_rules = {
        r.matcher_description
        for r in CONFIG.enhancements.iter_rules()
        if any(getattr(a, "var", None) == "category" for a in r.actions)
    }
    used_rules = set(used_inputs.keys())

    delete_rules = all_rules - used_rules
    if delete_rules:
        delete_rules_str = "\n".join(delete_rules)
        raise AssertionError(
            f"Found {len(delete_rules)} grouping enhancement rules that do not get exercized: \n{delete_rules_str}"
        )

    files_modified = []

    for input in INPUTS:
        if input.filename in delete_filenames:
            continue

        data = dict(input.data)

        modified = False
        modified |= _strip_sensitive_keys(data, ["exception", "platform", "event_id"])

        if "event_id" not in data:
            data["event_id"] = str(uuid.uuid4()).replace("-", "")
            modified = True

        if "exception" in data and "values" not in data["exception"]:
            del data["exception"]
            modified = True

        for exception in get_path(data, "exception", "values") or ():
            modified |= _strip_sensitive_keys(
                exception, ["stacktrace", "type", "value", "mechanism"]
            )
            modified |= _strip_sensitive_keys(get_path(exception, "stacktrace"), ["frames"])

            for frame in get_path(exception, "stacktrace", "frames") or ():
                # the following fields are inserted as part of the test,
                # they should not be written back, but we should also not
                # count removing them as modification
                category = None
                if frame.get("data"):
                    category = frame["data"].pop("category", None)
                    frame.pop("in_app", None)
                    frame["data"].pop("orig_in_app", None)

                if not frame.get("data"):
                    frame.pop("data", None)

                modified |= _strip_sensitive_keys(
                    frame, ["package", "filename", "function", "raw_function", "abs_path", "module"]
                )

                if not category:
                    modified |= frame != {"function": "stripped_application_code"}
                    frame.clear()
                    frame["function"] = "stripped_application_code"

        if modified:
            files_modified.append((input, data))

    if files_modified:
        if _SHOULD_DELETE_DATA:
            for input, new_data in files_modified:
                with open(os.path.join(_fixture_path, input.filename), "w") as f:
                    json.dump(new_data, f, indent=2, sort_keys=True)
                    f.write("\n")

        else:
            raise AssertionError(
                f"Would PII-strip {len(files_modified)} files, commit your changes and re-run with SENTRY_TEST_GROUPING_DELETE_USELESS_DATA=1"
            )


def _strip_sensitive_keys(data, keys):
    if not data:
        return False

    rv = False
    for key in list(data):
        if key not in keys:
            del data[key]
            rv = True

        elif data[key] is None:
            del data[key]
            rv = True

        elif any(x in key.lower() for x in _DELETE_KEYWORDS):
            del data[key]
            rv = True

        elif any(x in json.dumps(data[key]).lower() for x in _DELETE_KEYWORDS):
            del data[key]
            rv = True

    return rv


def _pre_scrub_event(data):
    # Make sure rules are only applied in exception interface. Otherwise one can:
    #
    # 1. Check in an event with a thread interface in event A1-4 and use it to exercise rules
    # 2. Later see that rule has been sufficiently exercised and remove event B
    # 3. Scrub events A1-4
    # 4. Now you have an unused rule to delete
    data.pop("stacktrace", None)
    data.pop("threads", None)
    return data
