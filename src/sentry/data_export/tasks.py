import base64
import logging
import tempfile
from hashlib import sha1
from io import BufferedRandom
from typing import Any, NamedTuple

import sentry_sdk
from django.core.files.base import ContentFile
from django.db import IntegrityError, router
from django.utils import timezone
from taskbroker_client.retry import NoRetriesRemainingError, Retry, retry_task

from sentry.data_export.models import ExportedData, ExportedDataBlob
from sentry.data_export.processors.discover import DiscoverProcessor
from sentry.data_export.processors.explore import ExploreProcessor, TraceItemFullExportProcessor
from sentry.data_export.processors.issues_by_tag import IssuesByTagProcessor
from sentry.data_export.utils import handle_snuba_errors
from sentry.data_export.writers import (
    FileWriter,
    OutputMode,
    get_content_type,
    get_file_type,
)
from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.models.files.utils import DEFAULT_BLOB_SIZE, MAX_FILE_SIZE, AssembleChecksumMismatch
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import export_tasks
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction

from .base import (
    EXPORTED_ROWS_LIMIT,
    MAX_BATCH_SIZE,
    MAX_FRAGMENTS_PER_BATCH,
    SNUBA_MAX_RESULTS,
    ExportError,
    ExportQueryType,
)

logger = logging.getLogger(__name__)

Processor = (
    IssuesByTagProcessor | DiscoverProcessor | ExploreProcessor | TraceItemFullExportProcessor
)


class AssembleChunkResult(NamedTuple):
    processor: Processor
    next_offset: int
    rows: list[dict[str, Any]]
    new_bytes_written: int
    bytes_written_after_chunk: int


def _export_metric_tags(data_export: ExportedData) -> dict[str, str]:
    dataset = data_export.query_info.get("dataset", "None")
    return {
        "format": data_export.export_format,
        "query_type": ExportQueryType.as_str(data_export.query_type),
        "dataset": dataset,
    }


def _is_full_jsonl_trace_item_export(data_export: ExportedData, output_mode: OutputMode) -> bool:
    return (
        data_export.query_type == ExportQueryType.EXPLORE
        and output_mode == OutputMode.JSONL
        and len(data_export.query_info.get("field", [])) == 0
    )


def _page_token_b64_from_processor(
    processor: IssuesByTagProcessor | DiscoverProcessor | ExploreProcessor,
) -> str | None:
    if isinstance(processor, TraceItemFullExportProcessor) and processor.page_token is not None:
        return base64.b64encode(processor.page_token).decode("ascii")
    return None


def _normalize_export_limit(export_limit: int | None) -> int:
    if export_limit is None:
        return EXPORTED_ROWS_LIMIT
    return min(export_limit, EXPORTED_ROWS_LIMIT)


def _fetch_exported_data_req_obj(
    data_export_id: int, first_page: bool, extra: dict[str, Any]
) -> ExportedData | None:
    try:
        if first_page:
            logger.info("dataexport.start", extra=extra)
        data_export = ExportedData.objects.get(id=data_export_id)
        if first_page:
            metrics.incr(
                "dataexport.start",
                tags={**_export_metric_tags(data_export), "success": True},
                sample_rate=1.0,
            )
        return data_export
    except ExportedData.DoesNotExist:
        if first_page:
            metrics.incr("dataexport.start", tags={"success": False}, sample_rate=1.0)
        logger.exception("assemble_download: ExportedData.DoesNotExist", extra=extra)
        return None


def _should_stop_fetching_more_fragments(
    processor: Processor,
    rows: list[dict[str, Any]],
    batch_size: int,
    tf: BufferedRandom,
    starting_pos: int,
) -> bool:
    """True when this activation should flush the chunk: no rows, size cap, or trace pagination end."""
    if not rows:
        return True
    partial_batch = len(rows) < batch_size
    partial_full_trace_batch = (
        isinstance(processor, TraceItemFullExportProcessor) and processor.page_token is not None
    )
    if partial_batch and not partial_full_trace_batch:
        return True
    if tf.tell() - starting_pos >= MAX_BATCH_SIZE:
        return True
    if isinstance(processor, TraceItemFullExportProcessor) and processor.page_token is None:
        return True
    return False


def _write_exported_chunk_to_blob(
    *,
    data_export: ExportedData,
    export_limit: int,
    batch_size: int,
    offset: int,
    bytes_written: int,
    environment_id: int | None,
    page_token: str | None,
    last_emitted_item_id_hex: str | None,
    first_page: bool,
) -> AssembleChunkResult:
    """One activation: fill up to MAX_FRAGMENTS_PER_BATCH fragments and persist a blob chunk."""
    output_mode = OutputMode.from_value(data_export.export_format)
    processor = get_processor(
        data_export,
        environment_id,
        output_mode,
        page_token_b64=page_token,
        last_emitted_item_id_hex=last_emitted_item_id_hex,
    )

    with tempfile.TemporaryFile(mode="w+b") as tf:
        writer = FileWriter(
            buffer=tf,
            output_mode=output_mode,
            csv_headers=processor.header_fields,
            escapechar="\\",
            extrasaction="ignore",
        )
        if first_page:
            writer.writeheader()

        starting_pos = tf.tell()
        fragment_offset = 0
        next_offset = offset + fragment_offset
        rows: list[dict[str, Any]] = []

        for _ in range(MAX_FRAGMENTS_PER_BATCH):
            remaining = export_limit - next_offset
            if remaining <= 0:
                break
            fragment_row_count = min(batch_size, remaining)
            rows = process_rows(processor, data_export, fragment_row_count, next_offset)
            writer.writerows(rows)

            fragment_offset += len(rows)
            next_offset = offset + fragment_offset

            if _should_stop_fetching_more_fragments(processor, rows, batch_size, tf, starting_pos):
                break

        tf.seek(0)
        new_bytes_written = store_export_chunk_as_blob(data_export, bytes_written, tf)
        bytes_written_after_chunk = bytes_written + new_bytes_written

    return AssembleChunkResult(
        processor=processor,
        next_offset=next_offset,
        rows=rows,
        new_bytes_written=new_bytes_written,
        bytes_written_after_chunk=bytes_written_after_chunk,
    )


def _schedule_retry(
    *,
    data_export_id: int,
    export_limit: int,
    batch_size: int,
    offset: int,
    base_bytes_written: int,
    environment_id: int | None,
    export_retries: int,
    page_token: str | None,
    last_emitted_item_id_hex: str | None,
) -> None:
    assemble_download.apply_async(
        args=[data_export_id],
        kwargs={
            "export_limit": export_limit,
            "batch_size": batch_size // 2,
            "offset": offset,
            "bytes_written": base_bytes_written,
            "environment_id": environment_id,
            "export_retries": export_retries - 1,
            "page_token": page_token,
            "last_emitted_item_id_hex": last_emitted_item_id_hex,
        },
    )


def _schedule_next_task(
    *,
    data_export_id: int,
    chunk: AssembleChunkResult,
    export_limit: int,
    batch_size: int,
    environment_id: int | None,
    export_retries: int,
) -> None:
    processor = chunk.processor
    next_offset = chunk.next_offset
    rows = chunk.rows
    new_bytes_written = chunk.new_bytes_written
    bytes_written = chunk.bytes_written_after_chunk

    cont_kwargs: dict[str, Any] = {
        "export_limit": export_limit,
        "batch_size": batch_size,
        "offset": next_offset,
        "bytes_written": bytes_written,
        "environment_id": environment_id,
        "export_retries": export_retries,
        "page_token": _page_token_b64_from_processor(processor),
    }
    if isinstance(processor, TraceItemFullExportProcessor):
        cont_kwargs["last_emitted_item_id_hex"] = processor.last_emitted_item_id_hex

    should_continue = (
        new_bytes_written
        and next_offset < export_limit
        and (
            (
                isinstance(processor, TraceItemFullExportProcessor)
                and processor.page_token is not None
            )
            or (
                not isinstance(processor, TraceItemFullExportProcessor)
                and rows
                and len(rows) >= batch_size
            )
        )
    )

    if should_continue:
        assemble_download.apply_async(
            args=[data_export_id],
            kwargs=cont_kwargs,
        )
    else:
        metrics.distribution("dataexport.row_count", next_offset, sample_rate=1.0)
        metrics.distribution("dataexport.file_size", bytes_written, sample_rate=1.0, unit="byte")
        merge_export_blobs.delay(data_export_id)


@instrumented_task(
    name="sentry.data_export.tasks.assemble_download",
    namespace=export_tasks,
    retry=Retry(
        times=3,
        delay=60,
    ),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
)
def assemble_download(
    data_export_id: int,
    export_limit: int | None = EXPORTED_ROWS_LIMIT,
    batch_size: int = SNUBA_MAX_RESULTS,
    offset: int = 0,
    bytes_written: int = 0,
    environment_id: int | None = None,
    export_retries: int = 3,
    *,
    page_token: str | None = None,
    last_emitted_item_id_hex: str | None = None,
    run_sync: bool = False,
    **kwargs: Any,
) -> None:
    # The API response to export the data contains the ID which you can use
    # to filter the GCP logs
    extra: dict[str, Any] = {"data_export_id": data_export_id}
    with sentry_sdk.start_span(op="assemble"):
        first_page = offset == 0
        data_export = _fetch_exported_data_req_obj(data_export_id, first_page, extra)
        if data_export is None:
            return

        _set_data_on_scope(data_export)

        base_bytes_written = bytes_written

        extra.update(
            {"query": str(data_export.payload), "organization_id": data_export.organization_id}
        )

        export_limit = _normalize_export_limit(export_limit)

        try:
            chunk = _write_exported_chunk_to_blob(
                data_export=data_export,
                export_limit=export_limit,
                batch_size=batch_size,
                offset=offset,
                bytes_written=bytes_written,
                environment_id=environment_id,
                page_token=page_token,
                last_emitted_item_id_hex=last_emitted_item_id_hex,
                first_page=first_page,
            )
        except ExportError as error:
            if error.recoverable and export_retries > 0:
                _schedule_retry(
                    data_export_id=data_export_id,
                    export_limit=export_limit,
                    batch_size=batch_size,
                    offset=offset,
                    base_bytes_written=base_bytes_written,
                    environment_id=environment_id,
                    export_retries=export_retries,
                    page_token=page_token,
                    last_emitted_item_id_hex=last_emitted_item_id_hex,
                )
            else:
                metrics.incr(
                    "dataexport.error",
                    tags={**_export_metric_tags(data_export), "error": str(error)},
                    sample_rate=1.0,
                )
                logger.exception("assemble_download: ExportError", extra=extra)
                return data_export.email_failure(message=str(error))
        except Exception as error:
            metrics.incr(
                "dataexport.error",
                tags={**_export_metric_tags(data_export), "error": str(error)},
                sample_rate=1.0,
            )
            logger.exception("assemble_download: Exception", extra=extra)

            try:
                retry_task()
            except NoRetriesRemainingError:
                metrics.incr(
                    "dataexport.end",
                    tags={
                        **_export_metric_tags(data_export),
                        "success": False,
                        "error": str(error),
                    },
                    sample_rate=1.0,
                )
                return data_export.email_failure(message="Internal processing failure")
        else:
            _schedule_next_task(
                data_export_id=data_export_id,
                chunk=chunk,
                export_limit=export_limit,
                batch_size=batch_size,
                environment_id=environment_id,
                export_retries=export_retries,
            )


def get_processor(
    data_export: ExportedData,
    environment_id: int | None,
    output_mode: OutputMode,
    *,
    page_token_b64: str | None = None,
    last_emitted_item_id_hex: str | None = None,
) -> IssuesByTagProcessor | DiscoverProcessor | ExploreProcessor | TraceItemFullExportProcessor:
    try:
        if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
            payload = data_export.query_info
            return IssuesByTagProcessor(
                project_id=payload["project"][0],
                group_id=payload["group"],
                key=payload["key"],
                environment_id=environment_id,
                tenant_ids={"organization_id": data_export.organization_id},
            )
        elif data_export.query_type == ExportQueryType.DISCOVER:
            return DiscoverProcessor(
                discover_query=data_export.query_info,
                organization=data_export.organization,
            )
        elif data_export.query_type == ExportQueryType.EXPLORE:
            if _is_full_jsonl_trace_item_export(data_export, output_mode):
                page_token: bytes | None = None
                if page_token_b64:
                    try:
                        page_token = base64.b64decode(page_token_b64)
                    except (ValueError, TypeError) as e:
                        raise ExportError("Invalid export trace item pagination state.") from e
                return TraceItemFullExportProcessor(
                    explore_query=data_export.query_info,
                    organization=data_export.organization,
                    output_mode=output_mode,
                    page_token=page_token,
                    last_emitted_item_id_hex=last_emitted_item_id_hex,
                )
            return ExploreProcessor(
                explore_query=data_export.query_info,
                organization=data_export.organization,
                output_mode=output_mode,
            )
        else:
            raise ExportError(f"No processor found for this query type: {data_export.query_type}")
    except ExportError as error:
        error_str = str(error)
        metrics.incr("dataexport.error", tags={"error": error_str}, sample_rate=1.0)
        raise


def process_rows(
    processor: Processor,
    data_export: ExportedData,
    batch_size: int,
    offset: int,
) -> list[dict[str, Any]]:
    try:
        if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
            rows = process_issues_by_tag(processor, batch_size, offset)
        elif data_export.query_type == ExportQueryType.DISCOVER:
            rows = process_discover(processor, batch_size, offset)
        elif data_export.query_type == ExportQueryType.EXPLORE:
            rows = process_explore(processor, batch_size, offset)
        else:
            raise ExportError(f"No processor found for this query type: {data_export.query_type}")
        return rows
    except ExportError as error:
        error_str = str(error)
        metrics.incr("dataexport.error", tags={"error": error_str}, sample_rate=1.0)
        raise


@handle_snuba_errors(logger)
def process_issues_by_tag(
    processor: IssuesByTagProcessor, limit: int, offset: int
) -> list[dict[str, Any]]:
    return processor.get_serialized_data(limit=limit, offset=offset)


@handle_snuba_errors(logger)
def process_discover(processor: DiscoverProcessor, limit: int, offset: int) -> list[dict[str, Any]]:
    raw_data_unicode = processor.data_fn(limit=limit, offset=offset)["data"]
    return processor.handle_fields(raw_data_unicode)


@handle_snuba_errors(logger)
def process_explore(
    processor: ExploreProcessor | TraceItemFullExportProcessor,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    return processor.run_query(offset, limit)


class ExportDataFileTooBig(Exception):
    pass


def store_export_chunk_as_blob(
    data_export: ExportedData,
    bytes_written: int,
    fileobj: BufferedRandom,
    blob_size: int = DEFAULT_BLOB_SIZE,
) -> int:
    try:
        with atomic_transaction(
            using=(
                router.db_for_write(FileBlob),
                router.db_for_write(ExportedDataBlob),
            )
        ):
            # adapted from `putfile` in  `src/sentry/models/file.py`
            bytes_offset = 0
            while True:
                contents = fileobj.read(blob_size)
                if not contents:
                    return bytes_offset

                blob_fileobj = ContentFile(contents)
                blob = FileBlob.from_file(blob_fileobj, logger=logger)
                ExportedDataBlob.objects.get_or_create(
                    data_export=data_export, blob_id=blob.id, offset=bytes_written + bytes_offset
                )

                bytes_offset += blob.size

                # there is a maximum file size allowed, so we need to make sure we don't exceed it
                # NOTE: there seems to be issues with downloading files larger than 1 GB on slower
                # networks, limit the export to 1 GB for now to improve reliability
                if bytes_written + bytes_offset >= min(MAX_FILE_SIZE, 2**30):
                    raise ExportDataFileTooBig()
    except ExportDataFileTooBig:
        return 0


@instrumented_task(
    name="sentry.data_export.tasks.merge_blobs",
    namespace=export_tasks,
    silo_mode=SiloMode.CELL,
)
def merge_export_blobs(data_export_id: int, **kwargs: Any) -> None:
    extra: dict[str, Any] = {"data_export_id": data_export_id}
    with sentry_sdk.start_span(op="merge"):
        try:
            data_export = ExportedData.objects.get(id=data_export_id)
        except ExportedData.DoesNotExist:
            logger.exception("merge_export_blobs: ExportedData.DoesNotExist", extra=extra)
            return

        _set_data_on_scope(data_export)

        extra.update(
            {"query": str(data_export.payload), "organization_id": data_export.organization_id}
        )

        # adapted from `putfile` in  `src/sentry/models/file.py`
        try:
            with atomic_transaction(
                using=(
                    router.db_for_write(File),
                    router.db_for_write(FileBlobIndex),
                )
            ):
                output_mode = OutputMode.from_value(data_export.export_format)
                file = File.objects.create(
                    name=data_export.file_name,
                    type=get_file_type(output_mode),
                    headers={"Content-Type": get_content_type(output_mode)},
                )
                size = 0
                file_checksum = sha1(b"")

                for export_blob in ExportedDataBlob.objects.filter(
                    data_export=data_export
                ).order_by("offset"):
                    blob = FileBlob.objects.get(pk=export_blob.blob_id)
                    FileBlobIndex.objects.create(file=file, blob=blob, offset=size)
                    size += blob.size
                    blob_checksum = sha1(b"")

                    with blob.getfile() as f:
                        for chunk in f.chunks():
                            blob_checksum.update(chunk)
                            file_checksum.update(chunk)

                    if blob.checksum != blob_checksum.hexdigest():
                        raise AssembleChecksumMismatch("Checksum mismatch")

                file.size = size
                file.checksum = file_checksum.hexdigest()
                file.save()

                # This is in a separate atomic transaction because in prod, files exist
                # outside of the primary database which means that the transaction to
                # the primary database is idle the entire time the writes the files
                # database is happening. In the event the writes to the files database
                # takes longer than the idle timeout, the connection to the primary
                # database can timeout causing a failure.
                with atomic_transaction(using=router.db_for_write(ExportedData)):
                    data_export.finalize_upload(file=file)

                time_elapsed = (timezone.now() - data_export.date_added).total_seconds()
                metrics.timing("dataexport.duration", time_elapsed, sample_rate=1.0)
                logger.info("dataexport.end", extra=extra)
                metrics.incr(
                    "dataexport.end",
                    tags={**_export_metric_tags(data_export), "success": True},
                    sample_rate=1.0,
                )
        except Exception as error:
            metrics.incr(
                "dataexport.error",
                tags={**_export_metric_tags(data_export), "error": str(error)},
                sample_rate=1.0,
            )
            metrics.incr(
                "dataexport.end",
                tags={**_export_metric_tags(data_export), "success": False, "error": str(error)},
                sample_rate=1.0,
            )
            logger.exception("merge_export_blobs: Exception", extra=extra)
            if isinstance(error, IntegrityError):
                message = "Failed to save the assembled file."
            else:
                message = "Internal processing failure."
            return data_export.email_failure(message=message)


def _set_data_on_scope(data_export: ExportedData) -> None:
    scope = sentry_sdk.get_isolation_scope()
    if data_export.user_id:
        user = dict(id=data_export.user_id)
        scope.set_user(user)
    scope.set_tag("organization.slug", data_export.organization.slug)
    scope.set_tag("export.type", ExportQueryType.as_str(data_export.query_type))
    scope.set_tag("export.format", data_export.export_format)
    qi = data_export.query_info
    if qi.get("dataset") is not None:
        scope.set_tag("export.dataset", str(qi.get("dataset")))
    scope.set_extra("export.query", data_export.query_info)
