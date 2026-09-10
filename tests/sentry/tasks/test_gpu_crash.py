from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest

from sentry.lang.native.teapot import TeapotUnavailable
from sentry.models.project import Project
from sentry.tasks.gpu_crash import _try_symbolicate, symbolicate_gpu_crash_event
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

# Patch where used (gpu_crash binds these names via top-level imports), not at
# their source modules.
FIND_DUMP = "sentry.tasks.gpu_crash.find_gpu_crash_dump_attachment"
FIND_SHADERS = "sentry.tasks.gpu_crash.find_all_shader_debug_attachments"
SUBMIT_TEAPOT = "sentry.tasks.gpu_crash.submit_to_teapot"
APPLY = "sentry.tasks.gpu_crash.apply_gpu_crash_symbolication"
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
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0


@django_db_all
def test_try_symbolicate_skipped_without_dump(default_project: Project) -> None:
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=None),
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0


@django_db_all
def test_try_symbolicate_teapot_outage_trips_breaker(
    default_project: Project, circuit_breaker: mock.Mock
) -> None:
    # A genuine outage (submit_to_teapot raises TeapotUnavailable) feeds the
    # breaker so repeated outages trip it.
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT, side_effect=TeapotUnavailable("down")),
        mock.patch(APPLY) as apply,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert apply.call_count == 0
    circuit_breaker.record_error.assert_called_once()
    circuit_breaker.record_success.assert_not_called()


@django_db_all
def test_try_symbolicate_request_error_does_not_trip_breaker(
    default_project: Project, circuit_breaker: mock.Mock
) -> None:
    # A client/data error (submit_to_teapot returns None) means teapot is healthy;
    # the breaker must not trip, or a burst of bad events would skip healthy ones.
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT, return_value=None),
        mock.patch(APPLY) as apply,
    ):
        changed = _try_symbolicate({"event_id": "e"}, default_project.id, "e")

    assert changed is False
    assert apply.call_count == 0
    circuit_breaker.record_error.assert_not_called()
    circuit_breaker.record_success.assert_not_called()


@django_db_all
def test_try_symbolicate_skips_when_killswitch_matches(
    default_project: Project, circuit_breaker: mock.Mock
) -> None:
    # Load-shedding must drain already-queued tasks, not just gate new routing:
    # the task re-checks the killswitch and skips teapot entirely.
    with (
        override_options({"teapot.enabled": True}),
        mock.patch("sentry.tasks.gpu_crash.killswitch_matches_context", return_value=True),
        mock.patch(SUBMIT_TEAPOT) as teapot,
    ):
        changed = _try_symbolicate({"event_id": "e", "platform": "native"}, default_project.id, "e")

    assert changed is False
    assert teapot.call_count == 0


@django_db_all
def test_try_symbolicate_skips_when_project_deleted(circuit_breaker: mock.Mock) -> None:
    # Project deleted between routing and execution is a routine stale ref — skip
    # cleanly, don't report it as an unexpected error.
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(SUBMIT_TEAPOT) as teapot,
        mock.patch("sentry.tasks.gpu_crash.sentry_sdk.capture_exception") as cap,
    ):
        changed = _try_symbolicate({"event_id": "e", "platform": "native"}, 2**31 - 1, "e")

    assert changed is False
    assert teapot.call_count == 0
    cap.assert_not_called()


@django_db_all
def test_try_symbolicate_swallows_errors(default_project: Project) -> None:
    # A hard failure deep in teapot must never propagate — the event still saves.
    with (
        override_options({"teapot.enabled": True}),
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


IS_GPU_EVENT = "sentry.lang.native.utils.is_gpu_crash_event"
SUBMIT_GPU = "sentry.tasks.gpu_crash.symbolicate_gpu_crash_event.delay"
KILLSWITCH = "sentry.tasks.store.killswitch_matches_context"
BACKUP = "sentry.tasks.store.reprocessing2.backup_unprocessed_event"


@django_db_all
def test_preprocess_routes_gpu_event_to_dedicated_task(default_project: Project) -> None:
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "native"}
    with (
        Feature("organizations:gpu-crash-symbolication"),
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
    # GPU events are enriched once, on ingest — deliberately NOT backed up, so a
    # later reprocess keeps the enriched event instead of dropping the enrichment.
    assert backup.call_count == 0


@django_db_all
def test_preprocess_not_routed_on_reprocessing(default_project: Project) -> None:
    # Reprocessing doesn't re-run teapot (the `.nv-gpudmp` isn't reloaded). GPU
    # events aren't backed up, so pull_event_data raises CannotReprocess and the
    # already-enriched event is kept as-is — never re-routed here.
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "native"}
    with (
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(IS_GPU_EVENT, return_value=True),
        mock.patch(SUBMIT_GPU) as submit_gpu,
        mock.patch("sentry.tasks.store.submit_save_event"),
        mock.patch("sentry.tasks.store.submit_process"),
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

    assert submit_gpu.call_count == 0


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


@django_db_all
def test_preprocess_not_routed_without_feature_flag(default_project: Project) -> None:
    # Org hasn't opted in: don't route to teapot even for a GPU crash event.
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "native"}
    with (
        mock.patch(IS_GPU_EVENT, return_value=True),
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
            has_attachments=True,
        )

    assert submit_gpu.call_count == 0


@django_db_all
def test_preprocess_sheds_gpu_event_when_killswitch_matches(default_project: Project) -> None:
    # The load-shed killswitch drops the isolated GPU routing so it can't overwhelm
    # the GPU task pool; the event still continues down the normal path.
    from sentry.tasks.store import _do_preprocess_event

    data = {"event_id": "e" * 32, "project": default_project.id, "platform": "native"}
    with (
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch(IS_GPU_EVENT, return_value=True),
        mock.patch(KILLSWITCH, return_value=True),
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
            has_attachments=True,
        )

    assert submit_gpu.call_count == 0
