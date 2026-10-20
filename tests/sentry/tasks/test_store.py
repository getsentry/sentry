from time import time
from unittest import mock

import orjson
import pytest
from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry import nodestore, options, quotas
from sentry.event_manager import EventManager
from sentry.exceptions import HashDiscarded
from sentry.tasks.store import (
    is_process_disabled,
    preprocess_event,
    process_event,
    save_event,
    save_event_attachments,
    save_event_transaction,
    should_process,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.viewer_context import ActorType, decode_viewer_context, get_viewer_context

EVENT_ID = "cc3e6c2bb6b6498097f336d1e6979f4b"


def _remove_extra(data):
    del data["extra"]
    return data


def _noop(data):
    return None


def _put_on_hold(data):
    data["unprocessed"] = True
    return data


@pytest.fixture
def mock_save_event():
    with mock.patch("sentry.tasks.store.save_event") as m:
        yield m


@pytest.fixture
def mock_process_event():
    with mock.patch("sentry.tasks.store.process_event") as m:
        yield m


@pytest.fixture
def mock_symbolicate_event():
    with mock.patch("sentry.tasks.symbolication.symbolicate_event") as m:
        yield m


@pytest.fixture
def mock_refund():
    with mock.patch.object(quotas, "refund") as m:
        yield m


@pytest.fixture
def mock_get_preprocessors():
    with mock.patch("sentry.tasks.store.get_event_preprocessors") as m:
        yield m


@django_db_all
def test_move_to_process_event(
    default_project,
    mock_process_event,
    mock_save_event,
    mock_symbolicate_event,
    mock_get_preprocessors,
):
    mock_get_preprocessors.return_value = [_remove_extra, _noop]
    data = {
        "project": default_project.id,
        "platform": "mattlang",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_save_event.delay.call_count == 0


@django_db_all
def test_move_to_process_event_inline_save_event_still_submits_process_event(
    default_project,
    mock_process_event,
    mock_save_event,
    mock_symbolicate_event,
    mock_get_preprocessors,
):
    mock_get_preprocessors.return_value = [_noop]
    data = {
        "project": default_project.id,
        "platform": "noop",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data, event_id=EVENT_ID, inline_save_event=True)

    assert mock_symbolicate_event.delay.call_count == 0
    mock_process_event.delay.assert_called_once_with(
        start_time=None,
        event_id=EVENT_ID,
        data_has_changed=False,
        from_symbolicate=False,
        has_attachments=False,
        data=data,
        unprocessed=None,
    )
    assert mock_save_event.call_count == 0
    assert mock_save_event.delay.call_count == 0


@django_db_all
def test_move_to_save_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event
):
    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 1


@django_db_all
def test_move_to_save_event_inline(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event
):
    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data, event_id=EVENT_ID, inline_save_event=True)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 0
    mock_save_event.assert_called_once_with(
        data=data,
        start_time=None,
        event_id=EVENT_ID,
        project_id=default_project.id,
        unprocessed=None,
    )
    assert mock_save_event.delay.call_count == 0


@django_db_all
def test_process_event_mutate_and_save(
    default_project,
    mock_save_event,
    mock_get_preprocessors,
):
    mock_get_preprocessors.return_value = [_remove_extra, _noop]

    data = {
        "project": default_project.id,
        "platform": "mattlang",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "_attachments": [{"id": 0, "key": "attachment-key", "name": "dump.dmp"}],
    }

    attachments = data["_attachments"]
    process_event(data=data, start_time=1)

    assert "extra" not in data
    assert data["_attachments"] == attachments

    mock_save_event.delay.assert_called_once_with(
        data=data,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
        unprocessed=None,
    )


@django_db_all
def test_process_event_no_mutate_and_save(default_project, mock_save_event, mock_get_preprocessors):
    mock_get_preprocessors.return_value = [_noop]

    data = {
        "project": default_project.id,
        "platform": "noop",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    process_event(data=data, start_time=1)

    mock_save_event.delay.assert_called_once_with(
        data=data,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
        unprocessed=None,
    )


@django_db_all
@pytest.mark.parametrize("load_shed", (False, True))
def test_process_event_payload_transport(
    default_project,
    mock_save_event,
    mock_get_preprocessors,
    load_shed,
):
    data = {"project": default_project.id, "event_id": EVENT_ID, "platform": "python"}
    mock_get_preprocessors.return_value = [_noop]
    with mock.patch("sentry.tasks.store.is_process_disabled", return_value=load_shed):
        process_event(data=data)

    assert mock_save_event.delay.call_args.kwargs["data"] == data


@django_db_all
def test_process_event_unprocessed(default_project, mock_save_event, mock_get_preprocessors):
    mock_get_preprocessors.return_value = [_put_on_hold]

    data = {
        "project": default_project.id,
        "platform": "holdmeclose",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    process_event(data=data, start_time=1)

    assert data["unprocessed"] is True

    mock_save_event.delay.assert_called_once_with(
        data=data,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
        unprocessed=None,
    )


@django_db_all
def test_hash_discarded_raised(default_project, mock_refund) -> None:
    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    now = time()
    mock_save = mock.Mock()
    mock_save.side_effect = HashDiscarded
    with mock.patch.object(EventManager, "save", mock_save):
        save_event(data=data, start_time=now)
        # should be caught


@django_db_all
@pytest.mark.parametrize("inline", [False, True])
def test_save_event_start_is_persisted_before_grouping(default_project, inline) -> None:
    manager = EventManager(
        {
            "project": default_project.id,
            "platform": "python",
            "event_id": EVENT_ID,
            "logentry": {"formatted": "test save start"},
        }
    )
    manager.normalize()
    data = manager.get_data()
    data["project"] = default_project.id
    data["save_event_start"] = 1
    cache_key = event_processing_store.store(data)
    saved_events = []
    original_save = EventManager.save

    with freeze_time() as clock:
        save_started = time()

        def slow_save(manager, **kwargs):
            assert manager.get_data()["save_event_start"] == save_started
            clock.shift(5)
            event = original_save(manager, **kwargs)
            saved_events.append(event)
            return event

        with mock.patch.object(EventManager, "save", autospec=True, side_effect=slow_save):
            save_event(
                data=data if inline else None,
                cache_key=cache_key,
                project_id=default_project.id,
            )

    assert len(saved_events) == 1
    persisted = nodestore.backend.get(saved_events[0].data.id)
    assert persisted is not None
    assert persisted["save_event_start"] == save_started
    assert persisted["nodestore_insert"] == save_started + 5


@django_db_all
def test_save_event_sets_viewer_context(default_project) -> None:
    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    captured_vc = None

    def capture_vc(*args, **kwargs):
        nonlocal captured_vc
        captured_vc = get_viewer_context()
        raise HashDiscarded("stop after capturing")

    with mock.patch.object(EventManager, "save", side_effect=capture_vc):
        save_event(data=data, start_time=time())

    assert captured_vc is not None
    assert captured_vc.organization_id == default_project.organization_id
    assert captured_vc.project_id == default_project.id
    assert captured_vc.actor_type == ActorType.SYSTEM


@django_db_all
@with_feature("projects:first-event-severity-calculation")
@with_feature("organizations:seer-based-priority")
@override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
@mock.patch(
    "sentry.event_manager.severity_connection_pool.urlopen",
    return_value=HTTPResponse(body=orjson.dumps({"severity": 0.1231}), status=200),
)
def test_save_event_passes_system_viewer_context_to_seer(mock_urlopen, default_project) -> None:
    data = {
        "project": default_project.id,
        "platform": "python",
        "event_id": EVENT_ID,
        "timestamp": time(),
        "level": "error",
        "exception": {
            "values": [
                {
                    "type": "NopeError",
                    "value": "Nopey McNopeface",
                    "mechanism": {"type": "generic", "handled": True},
                }
            ]
        },
    }

    manager = EventManager(data)
    manager.normalize()
    normalized_data = manager.get_data()
    normalized_data["project"] = default_project.id

    save_event(data=normalized_data, start_time=time())

    viewer_context = decode_viewer_context(
        mock_urlopen.call_args.kwargs["headers"]["X-Viewer-Context"],
        key="viewer-context-test-secret",
    )
    assert viewer_context.organization_id == default_project.organization_id
    assert viewer_context.project_id == default_project.id
    assert viewer_context.user_id is None
    assert viewer_context.actor_type == ActorType.SYSTEM


@django_db_all
def test_discard_event_cleans_up_attachments(default_project) -> None:
    data = {
        "project": default_project.id,
        "platform": "python",
        "event_id": EVENT_ID,
        "_attachments": [
            {
                "key": "e:attachment-event",
                "id": 0,
                "name": "attachment.txt",
                "stored_id": "stored-attachment",
            }
        ],
    }

    with (
        mock.patch.object(EventManager, "save", side_effect=HashDiscarded("discarded")),
        mock.patch("sentry.attachments.get_session") as get_session,
    ):
        save_event_attachments(
            data=data,
            project_id=default_project.id,
            start_time=time(),
        )

    get_session.return_value.delete.assert_called_once_with("stored-attachment")
    assert "_attachments" not in data


@pytest.fixture(params=["org", "project"])
def options_model(request, default_organization, default_project):
    if request.param == "org":
        return default_organization
    elif request.param == "project":
        return default_project
    else:
        raise AssertionError(request.param)


@django_db_all
@pytest.mark.parametrize("setting_method", ["datascrubbers", "piiconfig"])
def test_scrubbing_after_processing(
    default_project,
    default_organization,
    mock_save_event,
    mock_get_preprocessors,
    setting_method: str,
    options_model,
):
    def more_extra(data):
        data["extra"]["ooo2"] = "event preprocessor"
        return data

    mock_get_preprocessors.return_value = [more_extra]

    if setting_method == "datascrubbers":
        options_model.update_option("sentry:sensitive_fields", ["o"])
        options_model.update_option("sentry:scrub_data", True)
    elif setting_method == "piiconfig":
        options_model.update_option(
            "sentry:relay_pii_config", '{"applications": {"extra.ooo": ["@anything:replace"]}}'
        )
    else:
        raise AssertionError(setting_method)

    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"ooo": "remove me"},
    }

    # We pass data_has_changed=True to pretend that we've added "extra" attribute
    # to "data" shortly before (e.g. during symbolication).
    process_event(data=data, start_time=1, data_has_changed=True)

    saved_data = mock_save_event.delay.call_args.kwargs["data"]
    assert saved_data["extra"] == {"ooo": "[Filtered]", "ooo2": "event preprocessor"}

    mock_save_event.delay.assert_called_once_with(
        data=saved_data,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
        unprocessed=None,
    )


@django_db_all
def test_killswitch() -> None:
    assert not is_process_disabled(1, "asdasdasd", "null")
    options.set("store.load-shed-process-event-projects-gradual", {1: 0.0})
    assert not is_process_disabled(1, "asdasdasd", "null")
    options.set("store.load-shed-process-event-projects-gradual", {1: 1.0})
    assert is_process_disabled(1, "asdasdasd", "null")
    options.set("store.load-shed-process-event-projects-gradual", {})


@django_db_all
def test_store_consumer_type(
    default_project,
    mock_save_event,
):
    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
    }

    process_event(data=data, start_time=1)

    mock_save_event.delay.assert_called_once_with(
        data=data,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
        unprocessed=None,
    )

    transaction_data = {
        "project": default_project.id,
        "platform": "transaction",
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
        "start_timestamp": time() - 1,
    }

    with mock.patch("sentry.event_manager.EventManager.save", return_value=None) as save:
        save_event_transaction(
            data=transaction_data,
            start_time=1,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    save.assert_called_once()


@django_db_all
def test_should_process_new_path_js(default_project):
    data = {
        "project": default_project.id,
        "platform": "javascript",
        "event_id": EVENT_ID,
    }
    assert should_process(data) is True


@django_db_all
def test_should_process_new_path_java_proguard(default_project):
    data = {
        "project": default_project.id,
        "platform": "java",
        "event_id": EVENT_ID,
        "debug_meta": {"images": [{"type": "proguard", "uuid": "1234-abcd"}]},
    }
    assert should_process(data) is True


@django_db_all
def test_should_process_new_path_no_preprocessor(default_project):
    data = {
        "project": default_project.id,
        "platform": "python",
        "event_id": EVENT_ID,
    }
    assert should_process(data) is False


@django_db_all
def test_process_event_new_path_js(default_project, mock_save_event):
    data = {
        "project": default_project.id,
        "platform": "javascript",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
    }

    process_event(data=data, start_time=1)

    mock_save_event.delay.assert_called_once()


@django_db_all
def test_preprocess_routes_to_save_new_path_python(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event
):
    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
    }

    preprocess_event(data=data)

    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 1
