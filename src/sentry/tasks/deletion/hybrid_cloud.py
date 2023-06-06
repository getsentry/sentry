"""
Executes the eventually consistent cascades dictated by HybridCloudForeignKey fields on application models.

One job schedules on a regular interval the execute of smaller, per HCFK column jobs that each do a small chunk of work,
and then possibly reschedule to keep processing as necessary to stay caught up.

Notably, this job is only responsible for cascading to models that are related to deletions that have occurred in the
opposing silo and are stored in Tombstone rows.  Deletions that are not successfully synchronized via Outbox to a
Tombstone row will not, therefore, cascade to any related cross silo rows.
"""
import datetime
from dataclasses import dataclass
from hashlib import sha1
from typing import Any, List, Tuple, Type
from uuid import uuid4

import sentry_sdk
from django.apps import apps
from django.db import connections, router
from django.db.models import Manager, Max
from django.utils import timezone

from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models import TombstoneBase
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics, redis


@dataclass
class WatermarkBatch:
    low: int
    up: int
    has_more: bool
    transaction_id: str


def deletion_silo_modes() -> List[SiloMode]:
    cur = SiloMode.get_current_mode()
    result: List[SiloMode] = []
    if cur != SiloMode.REGION:
        result.append(SiloMode.CONTROL)
    if cur != SiloMode.CONTROL:
        result.append(SiloMode.REGION)
    return result


def get_watermark_key(prefix: str, field: HybridCloudForeignKey) -> str:
    return f"{prefix}.{field.model._meta.db_table}.{field.name}"


def get_watermark(prefix: str, field: HybridCloudForeignKey) -> Tuple[int, str]:
    with redis.clusters.get("default").get_local_client_for_key("deletions.watermark") as client:
        key = get_watermark_key(prefix, field)
        v = client.get(key)
        if v is None:
            result = (0, uuid4().hex)
            client.set(key, json.dumps(result))
            return result
        return tuple(json.loads(v))


def set_watermark(
    prefix: str, field: HybridCloudForeignKey, value: int, prev_transaction_id: str
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


def chunk_watermark_batch(
    prefix: str, field: HybridCloudForeignKey, manager: Manager, *, batch_size: int
) -> WatermarkBatch:
    lower, transaction_id = get_watermark(prefix, field)
    upper = manager.aggregate(Max("id"))["id__max"] or 0
    batch_upper = min(upper, lower + batch_size)

    # cap to batch size so that query timeouts don't get us.
    capped = upper
    if upper >= batch_upper:
        capped = batch_upper

    return WatermarkBatch(
        low=lower, up=capped, has_more=batch_upper < upper, transaction_id=transaction_id
    )


@instrumented_task(
    name="sentry.tasks.deletion.hybrid_cloud.schedule_hybrid_cloud_foreign_key_jobs",
    queue="cleanup",
    acks_late=True,
)
def schedule_hybrid_cloud_foreign_key_jobs():
    for silo_mode in deletion_silo_modes():
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

                    process_hybrid_cloud_foreign_key_cascade_batch.delay(
                        app_name=app,
                        model_name=model.__name__,
                        field_name=field.name,
                        silo_mode=silo_mode.name,
                    )


@instrumented_task(
    name="sentry.tasks.deletion.process_hybrid_cloud_foreign_key_cascade_batch",
    queue="cleanup",
    acks_late=True,
)
def process_hybrid_cloud_foreign_key_cascade_batch(
    app_name: str, model_name: str, field_name: str, silo_mode: str
) -> None:
    try:
        model = apps.get_model(app_label=app_name, model_name=model_name)
        try:
            field = model._meta.get_field(field_name)
            if not isinstance(field, HybridCloudForeignKey):
                raise Exception(f"The {field_name} field is not a HybridCloudForeignKey")
        except Exception as err:
            sentry_sdk.capture_exception(err)
            raise LookupError(f"Could not find field {field_name} on model {app_name}.{model_name}")

        tombstone_cls: Any = TombstoneBase.class_for_silo_mode(SiloMode[silo_mode])

        # We rely on the return value of _process_tombstone_reconciliation
        # to short circuit the second half of this `or` so that the terminal batch
        # also updates the tombstone watermark.
        if _process_tombstone_reconciliation(
            field, model, tombstone_cls, True
        ) or _process_tombstone_reconciliation(field, model, tombstone_cls, False):
            process_hybrid_cloud_foreign_key_cascade_batch.apply_async(
                kwargs=dict(
                    app_name=app_name,
                    model_name=model_name,
                    field_name=field_name,
                    silo_mode=silo_mode,
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
        raise err


# Convenience wrapper for mocking in tests
def get_batch_size() -> int:
    return 500


def _process_tombstone_reconciliation(
    field: HybridCloudForeignKey,
    model: Any,
    tombstone_cls: Type[TombstoneBase],
    row_after_tombstone: bool,
) -> bool:
    from sentry import deletions

    prefix = "tombstone"
    watermark_manager: Manager = tombstone_cls.objects
    watermark_target = "t"
    if row_after_tombstone:
        prefix = "row"
        watermark_manager: Manager = field.model.objects
        watermark_target = "r"

    watermark_batch = chunk_watermark_batch(
        prefix, field, watermark_manager, batch_size=get_batch_size()
    )
    has_more = watermark_batch.has_more
    to_delete_ids: List[int] = []

    if watermark_batch.low < watermark_batch.up:
        oldest_seen: datetime.datetime = timezone.now()

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

            for (row_id, tomb_created) in conn.fetchall():
                to_delete_ids.append(row_id)
                oldest_seen = min(oldest_seen, tomb_created)

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
