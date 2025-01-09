"""
A number of generic default fixtures to use with tests.

All model-related fixtures defined here require the database, and should imply as much by
including ``db`` fixture in the function resolution scope.
"""

import difflib
import os
import re
import sys
from collections.abc import Callable, Generator
from concurrent.futures import ThreadPoolExecutor
from string import Template
from typing import Any, Protocol

import pytest
import requests
import yaml
from django.core.cache import cache
from django.utils import timezone

import sentry

# These chars cannot be used in Windows paths so replace them:
# https://docs.microsoft.com/en-us/windows/desktop/FileIO/naming-a-file#naming-conventions
from sentry.types.activity import ActivityType

UNSAFE_PATH_CHARS = ("<", ">", ":", '"', " | ", "?", "*")


DIRECTORY_GROUPING_CHARS = ("::", "-", "[", "]", "\\")


def django_db_all(func=None, *, transaction=None, reset_sequences=None, **kwargs):
    """Pytest decorator for resetting all databases"""

    if func is not None:
        return pytest.mark.django_db(
            transaction=transaction, reset_sequences=reset_sequences, databases="__all__"
        )(func)

    def decorator(function):
        return pytest.mark.django_db(
            transaction=transaction, reset_sequences=reset_sequences, databases="__all__"
        )(function)

    return decorator


@pytest.fixture
def factories():
    # XXX(dcramer): hack to prevent recursive imports
    from sentry.testutils.factories import Factories

    return Factories


@pytest.fixture
def task_runner():
    """Context manager that ensures Celery tasks run directly inline where invoked.

    While this context manager is active any Celery tasks created will run immediately at
    the callsite rather than being sent to RabbitMQ and handled by a worker.
    """
    from sentry.testutils.helpers.task_runner import TaskRunner

    return TaskRunner


@pytest.fixture(scope="function")
def default_user(factories):
    """A default (super)user with email ``admin@localhost`` and password ``admin``.

    :returns: A :class:`sentry.users.models.user.User` instance.
    """
    return factories.create_user(email="admin@localhost", is_superuser=True)


@pytest.fixture(scope="function")
def default_organization(factories, default_user):
    """A default organization (slug=``baz``) owned by the ``default_user`` fixture.

    :returns: A :class:`sentry.models.organization.Organization` instance.
    """
    # XXX(dcramer): ensure that your org slug doesnt match your team slug
    # and the same for your project slug
    return factories.create_organization(name="baz", slug="baz", owner=default_user)


@pytest.fixture(scope="function")
def default_team(factories, default_organization):
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.organizationmemberteam import OrganizationMemberTeam

    team = factories.create_team(organization=default_organization, name="foo", slug="foo")
    # XXX: handle legacy team fixture
    queryset = OrganizationMember.objects.filter(organization=default_organization)
    for om in queryset:
        OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)
    return team


@pytest.fixture(scope="function")
def default_project(factories, default_team):
    return factories.create_project(name="Bar", slug="bar", teams=[default_team])


@pytest.fixture(scope="function")
def default_projectkey(factories, default_project):
    return factories.create_project_key(project=default_project)


@pytest.fixture(scope="function")
def default_environment(factories, default_project):
    return factories.create_environment(name="development", project=default_project)


@pytest.fixture(scope="function")
def default_group(factories, default_project):
    # こんにちは konichiwa
    return factories.create_group(project=default_project, message="\u3053\u3093\u306b\u3061\u306f")


@pytest.fixture(scope="function")
def default_activity(default_group, default_project, default_user):
    from sentry.models.activity import Activity

    return Activity.objects.create(
        group=default_group,
        project=default_project,
        type=ActivityType.NOTE.value,
        user_id=default_user.id,
        data={},
    )


@pytest.fixture()
def dyn_sampling_data():
    # return a function that returns fresh config so we don't accidentally get tests interfering with each other
    def inner(active=True):
        return {
            "rules": [
                {
                    "sampleRate": 0.7,
                    "type": "trace",
                    "active": active,
                    "condition": {
                        "op": "and",
                        "inner": [
                            {"op": "eq", "ignoreCase": True, "name": "field1", "value": ["val"]},
                            {"op": "glob", "name": "field1", "value": ["val"]},
                        ],
                    },
                }
            ],
        }

    return inner


_snapshot_writeback: str | None = os.environ.get("SENTRY_SNAPSHOTS_WRITEBACK") or "0"
if _snapshot_writeback in ("true", "1", "overwrite"):
    _snapshot_writeback = "overwrite"
elif _snapshot_writeback != "new":
    _snapshot_writeback = None
_test_base = os.path.realpath(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(sentry.__file__))))
)
_yaml_snap_re = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n(.*)$", re.DOTALL)


@pytest.fixture
def log():
    def inner(x):
        return sys.stdout.write(x + "\n")

    return inner


class ReadableYamlDumper(yaml.dumper.SafeDumper):
    """Disable pyyaml aliases for identical object references"""

    def ignore_aliases(self, data):
        return True


def read_snapshot_file(reference_file: str) -> tuple[str, str]:
    with open(reference_file, encoding="utf-8") as f:
        match = _yaml_snap_re.match(f.read())
        if match is None:
            raise OSError()

        header, refval = match.groups()
        return (header, refval)


InequalityComparator = Callable[[str, str], bool | str]
default_comparator = lambda refval, output: refval != output


class InstaSnapshotter(Protocol):
    def __call__(
        self,
        output: str | Any,
        reference_file: str | None = None,
        subname: str | None = None,
        inequality_comparator: InequalityComparator = default_comparator,
    ) -> None: ...


@pytest.fixture
def insta_snapshot(request: pytest.FixtureRequest) -> Generator[InstaSnapshotter]:
    def inner(
        output: str | Any,
        reference_file: str | None = None,
        subname: str | None = None,
        inequality_comparator: InequalityComparator = default_comparator,
    ) -> None:
        from sentry.testutils.silo import strip_silo_mode_test_suffix

        if reference_file is None:
            name = request.node.name
            for c in UNSAFE_PATH_CHARS:
                name = name.replace(c, "@")
            for c in DIRECTORY_GROUPING_CHARS:
                name = name.replace(c, "/")
            name = name.strip("/")

            if subname is not None:
                name += f"_{subname}"

            # If testing in an alternative silo mode, use the same snapshot as the
            # base test. This would need to change if we want different snapshots for
            # different silo modes.
            parent_name = strip_silo_mode_test_suffix(request.node.parent.name)

            reference_file = os.path.join(
                os.path.dirname(str(request.node.fspath)),
                "snapshots",
                os.path.splitext(os.path.basename(parent_name))[0],
                name + ".pysnap",
            )
        elif subname is not None:
            raise ValueError(
                "subname only works if you don't provide your own entire reference_file"
            )

        if not isinstance(output, str):
            output = yaml.dump(
                output, indent=2, default_flow_style=False, Dumper=ReadableYamlDumper
            )

        try:
            _, refval = read_snapshot_file(reference_file)
        except OSError:
            refval = ""

        refval = refval.rstrip()
        output = output.rstrip()
        is_unequal = inequality_comparator(refval, output)

        if _snapshot_writeback is not None and is_unequal:
            os.makedirs(os.path.dirname(reference_file), exist_ok=True)
            source = os.path.realpath(str(request.node.fspath))
            if source.startswith(_test_base + os.path.sep):
                source = source[len(_test_base) + 1 :]
            if _snapshot_writeback == "new":
                reference_file += ".new"
            with open(reference_file, "w") as f:
                f.write(
                    "---\n%s\n---\n%s\n"
                    % (
                        yaml.safe_dump(
                            {
                                "created": timezone.now().isoformat(),
                                "creator": "sentry",
                                "source": source,
                            },
                            indent=2,
                            default_flow_style=False,
                        ).rstrip(),
                        output,
                    )
                )
        elif is_unequal:
            __tracebackhide__ = True
            if isinstance(is_unequal, str):
                _print_custom_insta_diff(reference_file, is_unequal)
            else:
                _print_insta_diff(reference_file, refval, output)

    yield inner


INSTA_DIFF_TEMPLATE = Template(
    """~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Snapshot $reference_file changed!


Re-run pytest with SENTRY_SNAPSHOTS_WRITEBACK=new and then use 'make review-python-snapshots' to review.

Or: Use SENTRY_SNAPSHOTS_WRITEBACK=1 to update snapshots directly.


$diff_text
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
"""
)


def _print_insta_diff(reference_file, a, b):
    __tracebackhide__ = True
    pytest.fail(
        INSTA_DIFF_TEMPLATE.substitute(
            reference_file=reference_file,
            diff_text="\n".join(difflib.unified_diff(a.splitlines(), b.splitlines())),
        )
    )


def _print_custom_insta_diff(reference_file, diff_text):
    __tracebackhide__ = True
    pytest.fail(INSTA_DIFF_TEMPLATE.substitute(reference_file=reference_file, diff_text=diff_text))


@pytest.fixture
def call_snuba(settings):
    def inner(endpoint):
        return requests.post(settings.SENTRY_SNUBA + endpoint)

    return inner


@pytest.fixture
def reset_snuba(call_snuba):
    init_endpoints = [
        "/tests/events_analytics_platform/drop",
        "/tests/spans/drop",
        "/tests/events/drop",
        "/tests/functions/drop",
        "/tests/groupedmessage/drop",
        "/tests/transactions/drop",
        "/tests/metrics/drop",
        "/tests/generic_metrics/drop",
        "/tests/search_issues/drop",
        "/tests/group_attributes/drop",
    ]

    assert all(
        response.status_code == 200
        for response in ThreadPoolExecutor(len(init_endpoints)).map(call_snuba, init_endpoints)
    )


@pytest.fixture
def set_sentry_option():
    """
    A pytest-style wrapper around override_options.

    ```python
    def test_basic(set_sentry_option):
        with set_sentry_option("key", 1.0):
            do stuff
    ```
    """
    from sentry.testutils.helpers.options import override_options

    def inner(key, value):
        return override_options({key: value})

    return inner


@pytest.fixture
def django_cache():
    yield cache
    cache.clear()
