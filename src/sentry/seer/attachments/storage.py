from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict
from functools import partial
from hashlib import sha256
from typing import TypeVar, cast

import urllib3
from objectstore_client import Metadata, Session
from objectstore_client.errors import RequestError

from sentry import options
from sentry.objectstore import UsecaseId, get_org_session
from sentry.seer.attachments.models import (
    CONTENT_TYPES,
    VALIDATION_VERSION,
    Attachment,
    AttachmentError,
    AttachmentKind,
    AttachmentResponse,
    limit,
    observe,
    sanitize_filename,
    validate_key,
)
from sentry.utils.cache import cache
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.viewer_context import get_viewer_context

T = TypeVar("T")


def organization_id() -> int:
    viewer = get_viewer_context()
    if viewer is None or viewer.organization_id is None:
        raise RuntimeError("An authorized organization context is required for attachments")
    return viewer.organization_id


def session() -> Session:
    return get_org_session(
        UsecaseId.SEER_ATTACHMENTS,
        organization_id(),
        timeout=float(options.get("seer.attachments.storage-timeout-seconds")),
    )


def storage_request(call: Callable[[], T]) -> T:
    with observe("storage"):
        for attempt in range(2):
            try:
                return call()
            except RequestError as exc:
                if attempt or (exc.status != 429 and exc.status < 500):
                    raise AttachmentError(
                        "storage_unavailable", "Attachment storage is temporarily unavailable.", 503
                    ) from exc
            except urllib3.exceptions.HTTPError as exc:
                if attempt:
                    raise AttachmentError(
                        "storage_unavailable", "Attachment storage is temporarily unavailable.", 503
                    ) from exc
    raise AssertionError("Unreachable")


def put(data: bytes, attachment: Attachment) -> str:
    store = session()
    return storage_request(
        lambda: store.put(
            data,
            compress="none",
            content_type=attachment.content_type,
            filename=attachment.filename,
            metadata=attachment.custom_metadata(),
        )
    )


def from_metadata(metadata: Metadata) -> Attachment:
    kind = metadata.custom.get("kind")
    if (
        metadata.custom.get("validation_version") != VALIDATION_VERSION
        or kind not in CONTENT_TYPES
        or metadata.content_type not in CONTENT_TYPES[kind]
        or metadata.compression not in (None, "none")
        or not metadata.filename
        or metadata.size is None
        or metadata.size <= 0
    ):
        raise AttachmentError(
            "invalid_attachment", "The attachment does not have supported validation metadata."
        )
    try:
        attachment = Attachment(
            filename=sanitize_filename(metadata.filename),
            content_type=metadata.content_type,
            size=metadata.size,
            kind=cast(AttachmentKind, kind),
            width=int(metadata.custom["width"]) if kind == "image" else None,
            height=int(metadata.custom["height"]) if kind == "image" else None,
            page_count=int(metadata.custom["page_count"]) if kind == "pdf" else None,
        )
    except (KeyError, ValueError) as exc:
        raise AttachmentError(
            "invalid_attachment", "The attachment metadata is incomplete."
        ) from exc
    return attachment


def head(key: str, *, store: Session | None = None) -> Attachment | None:
    validate_key(key)
    store = store if store is not None else session()
    metadata = storage_request(lambda: store.head(key))
    return from_metadata(metadata) if metadata is not None else None


def metadata_batch(keys: list[str]) -> tuple[list[AttachmentResponse], list[str]]:
    if not keys or len(keys) > 50:
        raise AttachmentError("invalid_keys", "Request between one and 50 attachment keys.")
    keys = list(dict.fromkeys(validate_key(key) for key in keys))
    org = organization_id()
    cache_keys = {
        key: f"seer:attachment:v{VALIDATION_VERSION}:{org}:{sha256(key.encode()).hexdigest()}"
        for key in keys
    }
    cached = cache.get_many(list(cache_keys.values()))
    found: dict[str, Attachment] = {}
    missing: list[str] = []
    uncached: list[str] = []
    for key in keys:
        value = cached.get(cache_keys[key])
        if value is not None:
            found[key] = Attachment(**value)
        else:
            uncached.append(key)
    if uncached:
        # Resolve settings/options on the request thread before issuing HEADs.
        lookup = partial(head, store=session())
        with ContextPropagatingThreadPoolExecutor(max_workers=min(8, len(uncached))) as executor:
            for key, attachment in zip(uncached, executor.map(lookup, uncached)):
                if attachment is None:
                    missing.append(key)
                else:
                    found[key] = attachment
                    cache.set(cache_keys[key], asdict(attachment), timeout=300)
    return [found[key].response(key) for key in keys if key in found], missing


def validate_message(keys: list[str], query: str) -> None:
    if len(keys) > limit("max-message-files"):
        raise AttachmentError("too_many_attachments", "The message contains too many attachments.")
    if len(set(keys)) != len(keys):
        raise AttachmentError("duplicate_keys", "Attachment keys must be distinct.")
    for key in keys:
        validate_key(key)
    total = 0
    kinds: list[AttachmentKind] = []
    # Deliberately bypass the preview metadata cache: existence and current
    # policy must be checked immediately before sending a message to Seer.
    for key in keys:
        attachment = head(key)
        if attachment is None:
            raise AttachmentError("attachment_missing", "An attachment is missing or expired.")
        attachment.check_limits()
        total += attachment.size
        kinds.append(attachment.kind)
    if total > limit("max-message-bytes"):
        raise AttachmentError(
            "message_too_large", "The attachments exceed the combined size limit.", 413
        )
    if not query.strip() and (not kinds or any(kind != "image" for kind in kinds)):
        raise AttachmentError(
            "query_required", "A message is required unless all attachments are images."
        )


def read(key: str) -> tuple[bytes, Attachment]:
    def download() -> tuple[bytes, Attachment]:
        blob = session().get(key)
        if blob is None:
            raise AttachmentError(
                "attachment_missing", "The attachment is missing or expired.", 404
            )
        # Buffer these bounded files before sending headers so failures can
        # return 503, retries start from the beginning, and client disconnects
        # cannot strand an objectstore connection.
        with blob.payload:
            attachment = from_metadata(blob.metadata)
            attachment.check_limits()
            data = blob.payload.read(attachment.size + 1)
            if len(data) != attachment.size:
                raise urllib3.exceptions.ProtocolError("Incomplete attachment body")
        return data, attachment

    return storage_request(download)
