from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from functools import reduce
from typing import Any
from unittest import mock

from django.db import models
from django.db.models.functions import Cast
from django.http import HttpResponse

from sentry.constants import ObjectStatus
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode


def assert_mock_called_once_with_partial(mock: mock.Mock, *args: object, **kwargs: object) -> None:
    """
    Similar to ``mock.assert_called_once_with()``, but we don't require all
    args and kwargs to be specified.
    """
    assert len(mock.mock_calls) == 1
    m_args, m_kwargs = mock.call_args
    for i, arg in enumerate(args):
        assert m_args[i] == arg
    for kwarg in kwargs:
        assert m_kwargs[kwarg] == kwargs[kwarg], (m_kwargs[kwarg], kwargs[kwarg])


def assert_commit_shape(commit: Mapping[str, Any]) -> None:
    assert commit["id"]
    assert commit["repository"]
    assert commit["author_email"]
    assert commit["author_name"]
    assert commit["message"]
    assert commit["timestamp"]
    assert commit["patch_set"]
    patches = commit["patch_set"]
    for patch in patches:
        assert CommitFileChange.is_valid_type(patch["type"])
        assert patch["path"]


def assert_status_code(response: HttpResponse, minimum: int, maximum: int | None = None) -> None:
    # Omit max to assert status_code == minimum.
    maximum = maximum or minimum + 1
    assert minimum <= response.status_code < maximum, response


@contextmanager
def assert_no_organization_resource_hydration() -> Iterator[None]:
    with (
        mock.patch(
            "sentry.organizations.services.organization.serial.serialize_projects",
            side_effect=AssertionError("Unexpected project hydration"),
        ) as projects,
        mock.patch(
            "sentry.organizations.services.organization.serial.serialize_rpc_teams",
            side_effect=AssertionError("Unexpected team hydration"),
        ) as teams,
    ):
        yield
    # Catch hydration even when the caller handles the exception.
    projects.assert_not_called()
    teams.assert_not_called()


def assert_existing_projects_status(
    org: Organization, active_project_ids: list[int], deleted_project_ids: list[int]
) -> None:
    all_projects = Project.objects.filter(organization=org).values_list("id", "status")
    active_ids = []
    deleted_or_to_be_deleted_ids = []

    for project_id, status in all_projects:
        if status == ObjectStatus.ACTIVE:
            active_ids.append(project_id)
        else:
            deleted_or_to_be_deleted_ids.append(project_id)

    assert active_ids == active_project_ids
    assert deleted_or_to_be_deleted_ids == deleted_project_ids


@assume_test_silo_mode(SiloMode.CONTROL)
def org_audit_log_exists(**kwargs: object) -> bool:
    assert kwargs
    organization = kwargs.get("organization")
    if organization is not None:
        assert isinstance(organization, Organization)
        kwargs["organization_id"] = organization.id
        kwargs.pop("organization")
    if "data" in kwargs:
        kwargs["data__asjsonb"] = kwargs.pop("data")
    return (
        # would be nice to remove this and just use JSONField but the table is too big
        AuditLogEntry.objects.annotate(data__asjsonb=Cast("data", models.JSONField()))
        .filter(**kwargs)
        .exists()
    )


def assert_org_audit_log_exists(**kwargs: object) -> None:
    assert org_audit_log_exists(**kwargs)


"""
Helper functions to assert integration SLO metrics
"""


def assert_halt_metric(mock_record: mock.Mock, error_msg: object) -> None:
    (event_halts,) = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.HALTED
    )
    if isinstance(error_msg, Exception):
        assert isinstance(event_halts.args[1], type(error_msg))
    else:
        assert event_halts.args[1] == error_msg


def assert_failure_metric(mock_record: mock.Mock, error_msg: object) -> None:
    (event_failures,) = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.FAILURE
    )
    if isinstance(error_msg, Exception):
        assert isinstance(event_failures.args[1], type(error_msg))
    else:
        assert event_failures.args[1] == error_msg


def assert_success_metric(mock_record: mock.Mock) -> None:
    event_success = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.SUCCESS
    )
    assert event_success


def assert_slo_metric(
    mock_record: mock.Mock,
    event_outcome: EventLifecycleOutcome = EventLifecycleOutcome.SUCCESS,
) -> None:
    assert len(mock_record.mock_calls) == 2
    start, end = mock_record.mock_calls
    assert start.args[0] == EventLifecycleOutcome.STARTED
    assert end.args[0] == event_outcome


def assert_slo_metric_calls(
    mock_calls: Sequence[mock._Call],
    event_outcome: EventLifecycleOutcome = EventLifecycleOutcome.SUCCESS,
) -> None:
    start, end = mock_calls
    assert start.args[0] == EventLifecycleOutcome.STARTED
    assert end.args[0] == event_outcome


def assert_middleware_metrics(middleware_calls: Sequence[mock._Call]) -> None:
    start1, end1, start2, end2 = middleware_calls
    assert start1.args[0] == EventLifecycleOutcome.STARTED
    assert end1.args[0] == EventLifecycleOutcome.SUCCESS
    assert start2.args[0] == EventLifecycleOutcome.STARTED
    assert end2.args[0] == EventLifecycleOutcome.SUCCESS


def assert_count_of_metric(
    mock_record: mock.Mock, outcome: EventLifecycleOutcome, outcome_count: int
) -> None:
    calls = reduce(
        lambda acc, calls: (acc + 1 if calls.args[0] == outcome else acc),
        mock_record.mock_calls,
        0,
    )
    assert calls == outcome_count


# Given messages_or_errors need to align 1:1 to the calls :bufo-big-eyes:
def assert_many_halt_metrics(mock_record: mock.Mock, messages_or_errors: Sequence[object]) -> None:
    halts = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.HALTED
    )
    for halt, error_msg in zip(halts, messages_or_errors):
        if isinstance(error_msg, Exception):
            assert isinstance(halt.args[1], type(error_msg))
        else:
            assert halt.args[1] == error_msg


# Given messages_or_errors need to align 1:1 to the calls :bufo-big-eyes:
def assert_many_failure_metrics(
    mock_record: mock.Mock, messages_or_errors: Sequence[object]
) -> None:
    failures = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.FAILURE
    )
    for failure, error_msg in zip(failures, messages_or_errors):
        if isinstance(error_msg, Exception):
            assert isinstance(failure.args[1], type(error_msg))
        else:
            assert failure.args[1] == error_msg
