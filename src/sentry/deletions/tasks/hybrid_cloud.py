"""
Executes the eventually consistent cascades dictated by HybridCloudForeignKey fields on application models.

One job schedules on a regular interval the execute of smaller, per HCFK column jobs that each do a small chunk of work,
and then possibly reschedule to keep processing as necessary to stay caught up.

Notably, this job is only responsible for cascading to models that are related to deletions that have occurred in the
opposing silo and are stored in Tombstone rows.  Deletions that are not successfully synchronized via Outbox to a
Tombstone row will not, therefore, cascade to any related cross silo rows.
"""

import datetime
from collections import defaultdict
from dataclasses import dataclass
from hashlib import sha1
from typing import Any
from uuid import uuid4

import sentry_sdk
from celery import Task
from django.apps import apps
from django.db import connections, router
from django.db.models import Max, Min
from django.db.models.manager import BaseManager
from django.utils import timezone

from sentry import options
from sentry.db.models import Model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.tombstone import TombstoneBase
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics, redis


@dataclass
class WatermarkBatch:
    low: int
    up: int
    has_more: bool
    transaction_id: str


def get_watermark_key(prefix: str, field: HybridCloudForeignKey[Any, Any]) -> str:
    return f"{prefix}.{field.model._meta.db_table}.{field.name}"


def get_watermark(prefix: str, field: HybridCloudForeignKey[Any, Any]) -> tuple[int, str]:
    with redis.clusters.get("default").get_local_client_for_key("deletions.watermark") as client:
        key = get_watermark_key(prefix, field)
        v = client.get(key)
        if v is None:
            result = (0, uuid4().hex)
            client.set(key, json.dumps(result))
            return result
        lower, transaction_id = json.loads(v)
        if not (isinstance(lower, int) and isinstance(transaction_id, str)):
            raise TypeError("Expected watermarks data to be a tuple of (int, str)")
        return lower, transaction_id


def set_watermark(
    prefix: str, field: HybridCloudForeignKey[Any, Any], value: int, prev_transaction_id: str
) -> None:
    with redis.clusters.get("default").get_local_client_for_key("deletions.watermark") as client:
        client.set(
            get_watermark_key(prefix, field),
            json.dumps((value, sha1(prev_transaction_id.encode("utf8")).hexdigest())),
        )
    metrics.gauge(
        "deletion.hybrid_cloud.low_bound",
        value,
        tags=dict(
            field_name=f"{field.model._meta.db_table}.{field.name}",
            watermark=prefix,
        ),
    )


def _chunk_watermark_batch(
    prefix: str,
    field: HybridCloudForeignKey[Any, Any],
    manager: BaseManager[Any],
    *,
    batch_size: int,
    model: type[Model],
) -> WatermarkBatch:
    lower, transaction_id = get_watermark(prefix, field)
    agg = manager.aggregate(Min("id"), Max("id"))
    lower = lower or ((agg["id__min"] or 1) - 1)
    upper = agg["id__max"] or 0
    batch_upper = min(upper, lower + batch_size)

    # cap to batch size so that query timeouts don't get us.
    capped = upper
    if upper >= batch_upper:
        capped = batch_upper

    watermark_delta = max(upper - lower, 0)
    metric_field_name = f"{model._meta.db_table}:{field.name}"
    metric_tags = dict(field_name=metric_field_name, watermark_type=prefix)
    metrics.gauge(
        "deletion.hybrid_cloud.watermark_delta",
        value=watermark_delta,
        tags=metric_tags,
        sample_rate=1.0,
    )

    return WatermarkBatch(
        low=lower, up=capped, has_more=batch_upper < upper, transaction_id=transaction_id
    )


@instrumented_task(
    name="sentry.deletions.tasks.hybrid_cloud.schedule_hybrid_cloud_foreign_key_jobs_control",
    queue="cleanup.control",
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
def schedule_hybrid_cloud_foreign_key_jobs_control() -> None:
    if options.get("hybrid_cloud.disable_tombstone_cleanup"):
        return

    _schedule_hybrid_cloud_foreign_key(
        SiloMode.CONTROL, process_hybrid_cloud_foreign_key_cascade_batch_control
    )


@instrumented_task(
    name="sentry.deletions.tasks.hybrid_cloud.schedule_hybrid_cloud_foreign_key_jobs",
    queue="cleanup",
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def schedule_hybrid_cloud_foreign_key_jobs() -> None:
    if options.get("hybrid_cloud.disable_tombstone_cleanup"):
        return

    _schedule_hybrid_cloud_foreign_key(
        SiloMode.REGION, process_hybrid_cloud_foreign_key_cascade_batch
    )


def _schedule_hybrid_cloud_foreign_key(silo_mode: SiloMode, cascade_task: Task) -> None:
    for app, app_models in apps.all_models.items():
        for model in app_models.values():
            if not hasattr(model._meta, "silo_limit"):
                continue

            # Only process models local this operational mode.
            if silo_mode not in model._meta.silo_limit.modes:
                continue

            for field in model._meta.fields:
                if not isinstance(field, HybridCloudForeignKey):
                    continue

                cascade_task.delay(
                    app_name=app,
                    model_name=model.__name__,
                    field_name=field.name,
                    silo_mode=silo_mode.name,
                )


@instrumented_task(
    name="sentry.deletions.tasks.hybrid_cloud.process_hybrid_cloud_foreign_key_cascade_batch_control",
    queue="cleanup.control",
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
def process_hybrid_cloud_foreign_key_cascade_batch_control(
    app_name: str, model_name: str, field_name: str, **kwargs: Any
) -> None:
    if options.get("hybrid_cloud.disable_tombstone_cleanup"):
        return

    _process_hybrid_cloud_foreign_key_cascade(
        app_name=app_name,
        model_name=model_name,
        field_name=field_name,
        process_task=process_hybrid_cloud_foreign_key_cascade_batch_control,
        silo_mode=SiloMode.CONTROL,
    )


@instrumented_task(
    name="sentry.deletions.tasks.process_hybrid_cloud_foreign_key_cascade_batch",
    queue="cleanup",
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def process_hybrid_cloud_foreign_key_cascade_batch(
    app_name: str, model_name: str, field_name: str, **kwargs: Any
) -> None:
    if options.get("hybrid_cloud.disable_tombstone_cleanup"):
        return

    _process_hybrid_cloud_foreign_key_cascade(
        app_name=app_name,
        model_name=model_name,
        field_name=field_name,
        process_task=process_hybrid_cloud_foreign_key_cascade_batch,
        silo_mode=SiloMode.REGION,
    )


def _process_hybrid_cloud_foreign_key_cascade(
    app_name: str, model_name: str, field_name: str, process_task: Task, silo_mode: SiloMode
) -> None:
    """
    Called by the silo bound tasks above.
    """
    try:
        model = apps.get_model(app_label=app_name, model_name=model_name)
        try:
            field = model._meta.get_field(field_name)
            if not isinstance(field, HybridCloudForeignKey):
                raise Exception(f"The {field_name} field is not a HybridCloudForeignKey")
        except Exception as err:
            sentry_sdk.capture_exception(err)
            raise LookupError(f"Could not find field {field_name} on model {app_name}.{model_name}")

        tombstone_cls = TombstoneBase.class_for_silo_mode(silo_mode)
        assert tombstone_cls, "A tombstone class is required"

        # We rely on the return value of _process_tombstone_reconciliation
        # to short circuit the second half of this `or` so that the terminal batch
        # also updates the tombstone watermark.
        if _process_tombstone_reconciliation(
            field, model, tombstone_cls, True
        ) or _process_tombstone_reconciliation(field, model, tombstone_cls, False):
            process_task.apply_async(
                kwargs=dict(
                    app_name=app_name,
                    model_name=model_name,
                    field_name=field_name,
                    silo_mode=silo_mode.name,
                ),
                countdown=15,
            )
    except Exception as err:
        sentry_sdk.set_context(
            "deletion.hybrid_cloud",
            dict(
                app_name=app_name,
                model_name=model_name,
                field_name=field_name,
                silo_mode=silo_mode,
            ),
        )
        sentry_sdk.capture_exception(err)
        raise


# Convenience wrapper for mocking in tests
def get_batch_size() -> int:
    return 500


def _process_tombstone_reconciliation(
    field: HybridCloudForeignKey[Any, Any],
    model: Any,
    tombstone_cls: type[TombstoneBase],
    row_after_tombstone: bool,
) -> bool:
    from sentry import deletions

    prefix = "tombstone"
    watermark_manager: BaseManager[Any] = tombstone_cls.objects
    if row_after_tombstone:
        prefix = "row"
        watermark_manager = field.model.objects

    watermark_batch = _chunk_watermark_batch(
        prefix, field, watermark_manager, batch_size=get_batch_size(), model=model
    )
    has_more = watermark_batch.has_more
    if watermark_batch.low < watermark_batch.up:
        to_delete_ids, oldest_seen = _get_model_ids_for_tombstone_cascade(
            tombstone_cls=tombstone_cls,
            model=model,
            field=field,
            row_after_tombstone=row_after_tombstone,
            watermark_batch=watermark_batch,
        )

        if field.on_delete == "CASCADE":
            task = deletions.get(
                model=model,
                query={"id__in": to_delete_ids},
                transaction_id=watermark_batch.transaction_id,
            )

            if task.chunk():
                has_more = True  # The current batch is not complete, rerun this task again
            else:
                set_watermark(prefix, field, watermark_batch.up, watermark_batch.transaction_id)

        elif field.on_delete == "SET_NULL":
            model.objects.filter(id__in=to_delete_ids).update(**{field.name: None})
            set_watermark(prefix, field, watermark_batch.up, watermark_batch.transaction_id)

        elif field.on_delete == "DO_NOTHING":
            set_watermark(prefix, field, watermark_batch.up, watermark_batch.transaction_id)

        else:
            raise ValueError(
                f"{field.model.__name__}.{field.name} has unexpected on_delete={field.on_delete}, could not process delete!"
            )

        metrics.timing(
            "deletion.hybrid_cloud.processing_lag",
            datetime.datetime.now().timestamp() - oldest_seen.timestamp(),
            tags=dict(
                field_name=f"{model._meta.db_table}.{field.name}",
                watermark=prefix,
            ),
        )

    return has_more


def _get_model_ids_for_tombstone_cascade(
    tombstone_cls: type[TombstoneBase],
    model: type[Model],
    field: HybridCloudForeignKey[Any, Any],
    row_after_tombstone: bool,
    watermark_batch: WatermarkBatch,
) -> tuple[list[int], datetime.datetime]:
    """
    Queries the database or databases if spanning multiple, and returns
     a tuple with a list of row IDs to delete, and the oldest
     tombstone timestamp for the batch.

    :param tombstone_cls: Either a RegionTombstone or ControlTombstone, depending on
     which silo the tombstone process is running.
    :param model: The model with a HybridCloudForeignKey to process.
    :param field: The HybridCloudForeignKey field from the model to process.
    :param row_after_tombstone: Determines which table is bound by the
     watermark batch. When set to true, the model's IDs are used as the
     bounds, otherwise, the tombstone's IDs are used.
    :param watermark_batch: The batch information containing ID bounds for the
     watermark query.
    :return:
    """

    to_delete_ids = []
    oldest_seen = timezone.now()
    tombstone_and_model_in_same_db = router.db_for_read(model) == router.db_for_read(tombstone_cls)
    watermark_target = "t"

    if row_after_tombstone:
        watermark_target = "r"

    if tombstone_and_model_in_same_db:
        with connections[router.db_for_read(model)].cursor() as conn:
            conn.execute(
                f"""
                    SELECT r.id, t.created_at
                    FROM {model._meta.db_table} r
                    JOIN {tombstone_cls._meta.db_table} t
                        ON t.table_name = %(table_name)s AND t.object_identifier = r.{field.name}
                    WHERE {watermark_target}.id > %(low)s AND {watermark_target}.id <= %(up)s
                """,
                {
                    "table_name": field.foreign_table_name,
                    "low": watermark_batch.low,
                    "up": watermark_batch.up,
                },
            )

            for row_id, tomb_created in conn.fetchall():
                to_delete_ids.append(row_id)
                oldest_seen = min(oldest_seen, tomb_created)

            return to_delete_ids, oldest_seen

    # Because tombstones can span multiple databases, we can't always rely on
    # the join code above. Instead, we have to manually query IDs from the
    # watermark target table, querying the intersection of IDs manually.
    # The implementation of this varies depending on whether we are
    # processing row or tombstone watermarks.
    if row_after_tombstone:
        return get_ids_cross_db_for_row_watermark(
            tombstone_cls=tombstone_cls,
            model=model,
            field=field,
            row_watermark_batch=watermark_batch,
        )

    return get_ids_cross_db_for_tombstone_watermark(
        tombstone_cls=tombstone_cls,
        model=model,
        field=field,
        tombstone_watermark_batch=watermark_batch,
    )


def get_ids_cross_db_for_row_watermark(
    tombstone_cls: type[TombstoneBase],
    model: type[Model],
    field: HybridCloudForeignKey[Any, Any],
    row_watermark_batch: WatermarkBatch,
) -> tuple[list[int], datetime.datetime]:

    oldest_seen = timezone.now()
    model_object_id_pairs = model.objects.filter(
        id__lte=row_watermark_batch.up, id__gt=row_watermark_batch.low
    ).values_list("id", f"{field.name}")

    # Construct a map of foreign key IDs to model IDs, which gives us the
    # minimal set of foreign key values to lookup in the tombstones table.
    fk_to_model_id_map: defaultdict[int, set[int]] = defaultdict(set)
    for m_id, o_id in model_object_id_pairs:
        fk_to_model_id_map[o_id].add(m_id)

    object_ids_to_check = fk_to_model_id_map.keys()
    tombstone_entries = tombstone_cls.objects.filter(
        object_identifier__in=object_ids_to_check,
        table_name=field.foreign_table_name,
    ).values_list("object_identifier", "created_at")

    affected_rows: list[int] = []
    # Once we have the intersecting tombstones, use the dictionary we
    # created before to construct the minimal set of model IDs we need to
    # update with cascade behavior.
    for object_id, created_at in tombstone_entries:
        affected_rows.extend(fk_to_model_id_map[object_id])
        oldest_seen = min(oldest_seen, created_at)

    return affected_rows, oldest_seen


def get_ids_cross_db_for_tombstone_watermark(
    tombstone_cls: type[TombstoneBase],
    model: type[Model],
    field: HybridCloudForeignKey[Any, Any],
    tombstone_watermark_batch: WatermarkBatch,
) -> tuple[list[int], datetime.datetime]:
    oldest_seen = timezone.now()

    tombstone_entries = tombstone_cls.objects.filter(
        id__lte=tombstone_watermark_batch.up,
        id__gt=tombstone_watermark_batch.low,
        table_name=field.foreign_table_name,
    ).values_list("object_identifier", "created_at")

    ids_to_check = []
    for object_id, created_at in tombstone_entries:
        ids_to_check.append(object_id)
        oldest_seen = min(oldest_seen, created_at)

    field_name = f"{field.name}__in"
    query_kwargs = {field_name: ids_to_check}
    affected_rows = list(model.objects.filter(**query_kwargs).values_list("id", flat=True))

    return affected_rows, oldest_seen
