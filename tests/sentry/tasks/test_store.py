from time import time
from unittest import mock

import pytest

from sentry import options, quotas
from sentry.event_manager import EventManager
from sentry.exceptions import HashDiscarded
from sentry.ingest.types import ConsumerType
from sentry.services.eventstore.processing import event_processing_store
from sentry.tasks.store import (
    is_process_disabled,
    preprocess_event,
    process_event,
    save_event,
    save_event_attachments,
    save_event_transaction,
    should_process,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.cache import cache_key_for_event
from sentry.utils.event_tracker import TransactionStageStatus
from sentry.viewer_context import ActorType, get_viewer_context

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
def mock_save_event_transaction():
    with mock.patch("sentry.tasks.store.save_event_transaction") as m:
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
def mock_event_processing_store():
    with mock.patch("sentry.services.eventstore.processing.event_processing_store") as m:
        m.store.return_value = "e:1"
        yield m


@pytest.fixture
def mock_transaction_processing_store():
    with mock.patch("sentry.services.eventstore.processing.transaction_processing_store") as m:
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

    preprocess_event(cache_key="", data=data)

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

    preprocess_event(cache_key="e:1", data=data, event_id=EVENT_ID, inline_save_event=True)

    assert mock_symbolicate_event.delay.call_count == 0
    mock_process_event.delay.assert_called_once_with(
        cache_key=cache_key_for_event(data),
        start_time=None,
        event_id=EVENT_ID,
        data_has_changed=False,
        from_symbolicate=False,
        has_attachments=False,
        data=None,
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

    preprocess_event(cache_key="", data=data)

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

    preprocess_event(cache_key="e:1", data=data, event_id=EVENT_ID, inline_save_event=True)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 0
    mock_save_event.assert_called_once_with(
        cache_key=cache_key_for_event(data),
        data=None,
        start_time=None,
        event_id=EVENT_ID,
        project_id=default_project.id,
    )
    assert mock_save_event.delay.call_count == 0


@django_db_all
@pytest.mark.parametrize("cache_key,expected_writes", [("e:1", 1), (None, 0)])
def test_process_event_mutate_and_save(
    default_project,
    mock_event_processing_store,
    mock_save_event,
    mock_get_preprocessors,
    cache_key,
    expected_writes,
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

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = cache_key

    attachments = data["_attachments"]
    inline_data = data if cache_key is None else None
    process_event(cache_key=cache_key, data=inline_data, start_time=1)

    assert "extra" not in data
    assert data["_attachments"] == attachments
    assert mock_event_processing_store.store.call_args_list == [mock.call(data)] * expected_writes
    assert mock_event_processing_store.get.call_count == expected_writes

    mock_save_event.delay.assert_called_once_with(
        cache_key=cache_key,
        data=inline_data,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
    )


@django_db_all
def test_process_event_no_mutate_and_save(
    default_project, mock_event_processing_store, mock_save_event, mock_get_preprocessors
):
    mock_get_preprocessors.return_value = [_noop]

    data = {
        "project": default_project.id,
        "platform": "noop",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_event_processing_store.get.return_value = data

    with override_options(
        {"store.enable-inline-payloads": 0.0, "store.disable-processing-store": True}
    ):
        process_event(cache_key="e:1", start_time=1)

    mock_event_processing_store.get.assert_called_once_with("e:1")

    # A working key always causes a write, including unchanged payloads.
    mock_event_processing_store.store.assert_called_once_with(data)

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@django_db_all
@pytest.mark.parametrize(
    "cache_key,expected_writes,send_inline", [(None, 0, True), ("e:working", 1, False)]
)
@pytest.mark.parametrize("load_shed", (False, True))
def test_process_event_payload_transport(
    default_project,
    mock_event_processing_store,
    mock_save_event,
    mock_get_preprocessors,
    cache_key,
    expected_writes,
    send_inline,
    load_shed,
):
    data = {"project": default_project.id, "event_id": EVENT_ID, "platform": "python"}
    mock_get_preprocessors.return_value = [_noop]
    mock_event_processing_store.store.return_value = cache_key
    with (
        override_options(
            {
                "store.enable-inline-payloads": float(send_inline),
                "store.disable-processing-store": send_inline,
            }
        ),
        mock.patch("sentry.tasks.store.is_process_disabled", return_value=load_shed),
    ):
        process_event(cache_key=cache_key, data=data)

    mock_event_processing_store.get.assert_not_called()
    assert mock_event_processing_store.store.call_count == expected_writes
    assert mock_save_event.delay.call_args.kwargs["data"] == (data if send_inline else None)
    assert mock_save_event.delay.call_args.kwargs["cache_key"] == cache_key


@django_db_all
def test_process_event_unprocessed(
    default_project, mock_event_processing_store, mock_save_event, mock_get_preprocessors
):
    mock_get_preprocessors.return_value = [_put_on_hold]

    data = {
        "project": default_project.id,
        "platform": "holdmeclose",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    process_event(cache_key="e:1", start_time=1)

    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls
    assert event["unprocessed"] is True

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
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
def test_save_event_deletes_processing_store_at_end(
    default_project, mock_event_processing_store
) -> None:
    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
    }
    cache_key = "e:test"
    mock_event_processing_store.get.return_value = data
    calls = []

    with (
        mock.patch.object(EventManager, "save", side_effect=lambda **kwargs: calls.append("save")),
        mock.patch(
            "sentry.tasks.store.reprocessing2.mark_event_reprocessed",
            side_effect=lambda data: calls.append("reprocessing_cleanup"),
        ),
        mock.patch(
            "sentry.tasks.store.track_event_since_received",
            side_effect=lambda **kwargs: calls.append(kwargs["step"]),
        ),
    ):
        mock_event_processing_store.delete_by_key.side_effect = lambda key: calls.append("delete")
        save_event(cache_key=cache_key, event_id=EVENT_ID, project_id=default_project.id)

    assert calls == [
        "start_save_event",
        "save",
        "delete",
        "reprocessing_cleanup",
        "end_save_event",
    ]
    mock_event_processing_store.store.assert_not_called()
    mock_event_processing_store.delete_by_key.assert_called_once_with(cache_key)


@django_db_all
def test_inline_save_persists_then_cleans_up_backup_without_working_key(default_project):
    data = {"project": default_project.id, "event_id": EVENT_ID, "platform": "python"}
    key = event_processing_store.store(dict(data), unprocessed=True)
    working_key = cache_key_for_event(data)
    assert key == working_key + ":u"
    assert event_processing_store.get(working_key) is None

    def check_backup(**kwargs):
        assert kwargs["cache_key"] is None
        backup = event_processing_store.get(working_key, unprocessed=True)
        assert backup is not None
        assert backup["event_id"] == EVENT_ID

    with mock.patch.object(EventManager, "save", side_effect=check_backup):
        save_event(data=data, project_id=default_project.id)

    assert event_processing_store.get(working_key, unprocessed=True) is None


@django_db_all
@pytest.mark.parametrize("cache_key", (None, "e:test"))
def test_save_event_deletes_processing_store_on_failure(
    default_project, mock_event_processing_store, cache_key
) -> None:
    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
    }

    mock_event_processing_store.get.return_value = data

    with (
        mock.patch.object(EventManager, "save", side_effect=RuntimeError("save failed")),
        pytest.raises(RuntimeError, match="save failed"),
    ):
        save_event(
            cache_key=cache_key,
            data=data if cache_key is None else None,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    mock_event_processing_store.delete_by_key.assert_called_once_with(
        cache_key or cache_key_for_event(data)
    )


@django_db_all
@pytest.mark.parametrize("cache_key", (None, "", "e:working-event"))
def test_discard_event_cleans_up_attachments_with_optional_cache_key(
    default_project, cache_key
) -> None:
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
        mock.patch.object(event_processing_store, "delete_by_key") as delete,
    ):
        save_event_attachments(
            cache_key=cache_key,
            data=data,
            project_id=default_project.id,
            start_time=time(),
        )

    get_session.return_value.delete.assert_called_once_with("stored-attachment")
    delete.assert_called_once_with(cache_key or cache_key_for_event(data))
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
    mock_event_processing_store,
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

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    # We pass data_has_changed=True to pretend that we've added "extra" attribute
    # to "data" shortly before (e.g. during symbolication).
    process_event(cache_key="e:1", start_time=1, data_has_changed=True)

    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls
    assert event["extra"] == {"ooo": "[Filtered]", "ooo2": "event preprocessor"}

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
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
def test_transactions_store(default_project, mock_transaction_processing_store) -> None:
    data = {
        "project": default_project.id,
        "platform": "transaction",
        "event_id": EVENT_ID,
        "type": "transaction",
        "transaction": "minimal_transaction",
        "timestamp": time(),
        "start_timestamp": time() - 1,
    }

    mock_transaction_processing_store.store.return_value = "e:1"
    mock_transaction_processing_store.get.return_value = data
    with mock.patch("sentry.event_manager.EventManager.save", return_value=None):
        save_event_transaction(
            cache_key="e:1",
            data=None,
            start_time=1,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    mock_transaction_processing_store.get.assert_called_once_with("e:1")


@django_db_all
@pytest.mark.parametrize(
    ("cache_key", "expected_stages"),
    (
        (
            None,
            [TransactionStageStatus.SAVE_TXN_STARTED, TransactionStageStatus.SAVE_TXN_FINISHED],
        ),
        (
            "e:1",
            [
                TransactionStageStatus.SAVE_TXN_STARTED,
                TransactionStageStatus.REDIS_DELETED,
                TransactionStageStatus.SAVE_TXN_FINISHED,
            ],
        ),
    ),
)
def test_inline_transaction_tracks_redis_deletion_only_with_cache_key(
    default_project, mock_transaction_processing_store, cache_key, expected_stages
) -> None:
    data = {"project": default_project.id, "event_id": EVENT_ID, "type": "transaction"}

    with (
        mock.patch.object(EventManager, "save"),
        mock.patch("sentry.tasks.store.track_sampled_event") as track,
    ):
        save_event_transaction(
            cache_key=cache_key,
            data=data,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    assert track.call_args_list == [
        mock.call(EVENT_ID, ConsumerType.Transactions, stage) for stage in expected_stages
    ]
    mock_transaction_processing_store.get.assert_not_called()
    mock_transaction_processing_store.delete_by_key.assert_called_once_with(
        cache_key or cache_key_for_event(data)
    )


@django_db_all
def test_store_consumer_type(
    default_project,
    mock_save_event,
    mock_save_event_transaction,
    mock_event_processing_store,
    mock_transaction_processing_store,
):
    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:2"

    process_event(cache_key="e:2", start_time=1)

    mock_event_processing_store.get.assert_called_once_with("e:2")

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:2",
        data=None,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
    )

    transaction_data = {
        "project": default_project.id,
        "platform": "transaction",
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
        "start_timestamp": time() - 1,
    }

    mock_transaction_processing_store.get.return_value = transaction_data
    mock_transaction_processing_store.store.return_value = "tx:3"

    with mock.patch("sentry.event_manager.EventManager.save", return_value=None):
        save_event_transaction(
            cache_key="tx:3",
            data=None,
            start_time=1,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    mock_transaction_processing_store.get.assert_called_once_with("tx:3")
    mock_transaction_processing_store.delete_by_key.assert_called_once_with("tx:3")
    mock_transaction_processing_store.store.assert_not_called()


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
def test_process_event_new_path_js(default_project, mock_event_processing_store, mock_save_event):
    data = {
        "project": default_project.id,
        "platform": "javascript",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    process_event(cache_key="e:1", start_time=1)

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

    preprocess_event(cache_key="", data=data)

    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 1
