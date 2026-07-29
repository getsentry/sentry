from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest

from sentry.models.project import Project
from sentry.tasks.gpu_crash import (
    _try_symbolicate,
    submit_symbolicate_gpu_crash,
    symbolicate_gpu_crash_event,
)
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

FIND_DUMP = "sentry.lang.native.utils.find_gpu_crash_dump_attachment"
FIND_SHADERS = "sentry.lang.native.utils.find_all_shader_debug_attachments"
SUBMIT_TEAPOT = "sentry.lang.native.teapot.submit_to_teapot"
APPLY = "sentry.lang.native.gpu.apply_gpu_crash_symbolication"
SUBMIT_PROCESS = "sentry.tasks.store.submit_process"


class _FakeAttachment:
    def __init__(self, name: str = "dump.nv-gpudmp", data: bytes = b"dump") -> None:
        self.name = name
        self.stored_id = None
        self._data = data

    def load_data(self, project: Any = None) -> bytes:
        return self._data


def _completed() -> dict[str, Any]:
    return {"status": "completed", "fault_category": "shader_hang"}


@pytest.fixture(autouse=True)
def circuit_breaker() -> Iterator[mock.Mock]:
    breaker = mock.Mock()
    breaker.should_allow_request.return_value = True
    with mock.patch("sentry.tasks.gpu_crash._teapot_circuit_breaker", return_value=breaker):
        yield breaker


@django_db_all
def test_try_symbolicate_happy_path(default_project: Project, circuit_breaker: mock.Mock) -> None:
    data: dict[str, Any] = {"event_id": "e", "project": default_project.id}
    with (
        override_options({"teapot.enabled": True}),
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT, return_value=_completed()) as teapot,
        mock.patch(APPLY, return_value=data) as apply,
    ):
        changed = _try_symbolicate(data, default_project.id, "e")

    assert changed is True
    assert teapot.call_count == 1
    assert apply.call_count == 1

    # A successful decode closes the loop on the breaker.
    circuit_breaker.record_success.assert_called_once()
    circuit_breaker.record_error.assert_not_called()


@django_db_all
def test_try_symbolicate_skips_when_circuit_open(
    default_project: Project, circuit_breaker: mock.Mock
) -> None:
    # An open breaker means teapot is presumed down: skip the call entirely and
    # save the event unenriched, paying no request timeout.
    circuit_breaker.should_allow_request.return_value = False
    with (
        override_options({"teapot.enabled": True}),
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0
    circuit_breaker.record_success.assert_not_called()
    circuit_breaker.record_error.assert_not_called()


@django_db_all
def test_try_symbolicate_skipped_when_disabled(default_project: Project) -> None:
    with (
        override_options({"teapot.enabled": False}),
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0


@django_db_all
def test_try_symbolicate_skipped_when_flag_off(default_project: Project) -> None:
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0


@django_db_all
def test_try_symbolicate_skipped_without_dump(default_project: Project) -> None:
    with (
        override_options({"teapot.enabled": True}),
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(FIND_DUMP, return_value=None),
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0


@django_db_all
def test_try_symbolicate_teapot_unavailable(
    default_project: Project, circuit_breaker: mock.Mock
) -> None:
    with (
        override_options({"teapot.enabled": True}),
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT, return_value=None),
        mock.patch(APPLY) as apply,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert apply.call_count == 0
    # A teapot failure feeds the breaker so repeated outages trip it.
    circuit_breaker.record_error.assert_called_once()
    circuit_breaker.record_success.assert_not_called()


@django_db_all
def test_try_symbolicate_swallows_errors(default_project: Project) -> None:
    # A hard failure deep in teapot must never propagate — the event still saves.
    with (
        override_options({"teapot.enabled": True}),
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT, side_effect=RuntimeError("boom")),
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False


def test_task_always_continues_to_save() -> None:
    # Whatever teapot does, the event is handed to submit_process — Relay already
    # ingested and billed it.
    data = {"event_id": "e" * 32, "project": 1}
    with (
        mock.patch("sentry.tasks.gpu_crash._try_symbolicate", return_value=False),
        mock.patch(SUBMIT_PROCESS) as submit_process,
    ):
        symbolicate_gpu_crash_event(cache_key="k", data=data, has_attachments=True)

    assert submit_process.call_count == 1
    assert submit_process.call_args.kwargs["from_symbolicate"] is True
    assert submit_process.call_args.kwargs["data_has_changed"] is False


def test_submit_schedules_on_dedicated_queue() -> None:
    with mock.patch("sentry.tasks.gpu_crash.symbolicate_gpu_crash_event.delay") as delay:
        submit_symbolicate_gpu_crash(
            cache_key="k",
            event_id="e",
            start_time=None,
            has_attachments=True,
            from_reprocessing=False,
        )

    assert delay.call_count == 1
    assert delay.call_args.kwargs["cache_key"] == "k"


IS_GPU_EVENT = "sentry.lang.native.utils.is_gpu_crash_event"
SUBMIT_GPU = "sentry.tasks.gpu_crash.submit_symbolicate_gpu_crash"


BACKUP = "sentry.tasks.store.reprocessing2.backup_unprocessed_event"


@django_db_all
def test_preprocess_routes_gpu_event_to_dedicated_task(default_project: Project) -> None:
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "native"}
    with (
        mock.patch(IS_GPU_EVENT, return_value=True),
        mock.patch(SUBMIT_GPU) as submit_gpu,
        mock.patch(BACKUP) as backup,
    ):
        _do_preprocess_event(
            cache_key="k",
            data=data,
            start_time=None,
            event_id="e" * 32,
            from_reprocessing=False,
            project=default_project,
            has_attachments=True,
        )

    assert submit_gpu.call_count == 1
    # The unprocessed event is backed up so a later reprocess can reload + re-run teapot.
    assert backup.call_count == 1


@django_db_all
def test_preprocess_routes_gpu_event_on_reprocessing(default_project: Project) -> None:
    # Reprocessing never sets has_attachments, but a restored GPU dump must still
    # route to teapot (and be backed up) rather than skipping symbolication.
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "native"}
    with (
        mock.patch(IS_GPU_EVENT, return_value=True),
        mock.patch(SUBMIT_GPU) as submit_gpu,
        mock.patch(BACKUP) as backup,
    ):
        _do_preprocess_event(
            cache_key="k",
            data=data,
            start_time=None,
            event_id="e" * 32,
            from_reprocessing=True,
            project=default_project,
            has_attachments=False,
        )

    assert submit_gpu.call_count == 1
    assert backup.call_count == 1


@django_db_all
def test_preprocess_ignores_non_gpu_event(default_project: Project) -> None:
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "python"}
    with (
        mock.patch(IS_GPU_EVENT, return_value=False),
        mock.patch(SUBMIT_GPU) as submit_gpu,
        mock.patch("sentry.tasks.store.submit_save_event"),
        mock.patch("sentry.tasks.store.submit_process"),
    ):
        _do_preprocess_event(
            cache_key="k",
            data=data,
            start_time=None,
            event_id="e" * 32,
            from_reprocessing=False,
            project=default_project,
            has_attachments=False,
        )

    assert submit_gpu.call_count == 0
