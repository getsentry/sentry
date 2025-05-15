import os
import random
import threading
from datetime import datetime, timezone
from typing import Optional, List, Callable, TYPE_CHECKING, Any

from sentry_sdk_alpha.utils import format_timestamp, safe_repr
from sentry_sdk_alpha.envelope import Envelope, Item, PayloadRef

if TYPE_CHECKING:
    from sentry_sdk_alpha._types import Log


class LogBatcher:
    MAX_LOGS_BEFORE_FLUSH = 100
    FLUSH_WAIT_TIME = 5.0

    def __init__(
        self,
        capture_func,  # type: Callable[[Envelope], None]
    ):
        # type: (...) -> None
        self._log_buffer = []  # type: List[Log]
        self._capture_func = capture_func
        self._running = True
        self._lock = threading.Lock()

        self._flush_event = threading.Event()  # type: threading.Event

        self._flusher = None  # type: Optional[threading.Thread]
        self._flusher_pid = None  # type: Optional[int]

    def _ensure_thread(self):
        # type: (...) -> bool
        """For forking processes we might need to restart this thread.
        This ensures that our process actually has that thread running.
        """
        if not self._running:
            return False

        pid = os.getpid()
        if self._flusher_pid == pid:
            return True

        with self._lock:
            # Recheck to make sure another thread didn't get here and start the
            # the flusher in the meantime
            if self._flusher_pid == pid:
                return True

            self._flusher_pid = pid

            self._flusher = threading.Thread(target=self._flush_loop)
            self._flusher.daemon = True

            try:
                self._flusher.start()
            except RuntimeError:
                # Unfortunately at this point the interpreter is in a state that no
                # longer allows us to spawn a thread and we have to bail.
                self._running = False
                return False

        return True

    def _flush_loop(self):
        # type: (...) -> None
        while self._running:
            self._flush_event.wait(self.FLUSH_WAIT_TIME + random.random())
            self._flush_event.clear()
            self._flush()

    def add(
        self,
        log,  # type: Log
    ):
        # type: (...) -> None
        if not self._ensure_thread() or self._flusher is None:
            return None

        with self._lock:
            self._log_buffer.append(log)
            if len(self._log_buffer) >= self.MAX_LOGS_BEFORE_FLUSH:
                self._flush_event.set()

    def kill(self):
        # type: (...) -> None
        if self._flusher is None:
            return

        self._running = False
        self._flush_event.set()
        self._flusher = None

    def flush(self):
        # type: (...) -> None
        self._flush()

    @staticmethod
    def _log_to_transport_format(log):
        # type: (Log) -> Any
        def format_attribute(val):
            # type: (int | float | str | bool) -> Any
            if isinstance(val, bool):
                return {"value": val, "type": "boolean"}
            if isinstance(val, int):
                return {"value": val, "type": "integer"}
            if isinstance(val, float):
                return {"value": val, "type": "double"}
            if isinstance(val, str):
                return {"value": val, "type": "string"}
            return {"value": safe_repr(val), "type": "string"}

        if "sentry.severity_number" not in log["attributes"]:
            log["attributes"]["sentry.severity_number"] = log["severity_number"]
        if "sentry.severity_text" not in log["attributes"]:
            log["attributes"]["sentry.severity_text"] = log["severity_text"]

        res = {
            "timestamp": int(log["time_unix_nano"]) / 1.0e9,
            "trace_id": log.get("trace_id", "00000000-0000-0000-0000-000000000000"),
            "level": str(log["severity_text"]),
            "body": str(log["body"]),
            "attributes": {
                k: format_attribute(v) for (k, v) in log["attributes"].items()
            },
        }

        return res

    def _flush(self):
        # type: (...) -> Optional[Envelope]

        envelope = Envelope(
            headers={"sent_at": format_timestamp(datetime.now(timezone.utc))}
        )
        with self._lock:
            if len(self._log_buffer) == 0:
                return None

            envelope.add_item(
                Item(
                    type="log",
                    content_type="application/vnd.sentry.items.log+json",
                    headers={
                        "item_count": len(self._log_buffer),
                    },
                    payload=PayloadRef(
                        json={
                            "items": [
                                self._log_to_transport_format(log)
                                for log in self._log_buffer
                            ]
                        }
                    ),
                )
            )
            self._log_buffer.clear()

        self._capture_func(envelope)
        return envelope
