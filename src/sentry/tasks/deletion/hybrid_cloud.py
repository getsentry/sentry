from hashlib import sha1
from typing import Any, List, Tuple, Type
from uuid import uuid4

from django.apps import apps
from django.core.cache import cache
from django.db.models import Manager, Max

from sentry.db.models.fields.hybrid_cloud_foreign_key import (
    HybridCloudForeignKey,
    HybridCloudForeignKeyCascadeBehavior,
)
from sentry.models import TombstoneBase
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


def deletion_silo_modes() -> List[SiloMode]:
    cur = SiloMode.get_current_mode()
    result: List[SiloMode] = []
    if cur != SiloMode.REGION:
        result.append(SiloMode.CONTROL)
    if cur != SiloMode.CONTROL:
        result.append(SiloMode.REGION)
    return result


# TODO: do not use django caches, use either redis, or db.
def get_watermark(prefix: str, field: HybridCloudForeignKey) -> Tuple[int, str]:
    return cache.get(f"{prefix}.{field.model._meta.db_table}.{field.name}") or (0, uuid4().hex)


def set_watermark(
    prefix: str, field: HybridCloudForeignKey, value: int, prev_transaction_id: str
) -> None:
    return cache.set(
        f"{prefix}.{field.model._meta.db_table}.{field.name}",
        (value, sha1(prev_transaction_id.encode("utf8") + bytes([value])).hexdigest()),
    )


def chunk_watermark_batch(
    prefix: str, field: HybridCloudForeignKey, manager: Manager, *, batch_size: int
) -> Tuple[int, int, bool, str]:
    lower, transaction_id = get_watermark(prefix, field)
    upper = manager.aggregate(Max("id"))["id__max"] or 0
    batch_upper = min(upper, lower + batch_size)
    return lower, upper, batch_upper + batch_size < upper, transaction_id


@instrumented_task(
    name="sentry.tasks.deletion.schedule_hybrid_cloud_foreign_key_jobs",
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
    model = apps.get_model(app_label=app_name, model_name=model_name)
    field: HybridCloudForeignKey
    for field in model._meta.fields:
        if not isinstance(field, HybridCloudForeignKey):
            continue
        if field.name == field_name:
            break
    else:
        raise LookupError(f"Could not find field {field_name} on model {app_name}.{model_name}")

    tombstone_cls: Any = TombstoneBase.class_for_silo_mode(SiloMode[silo_mode])

    if _process_tombstone_reconcilition(
        field, model, tombstone_cls, True
    ) or _process_tombstone_reconcilition(field, model, tombstone_cls, False):
        process_hybrid_cloud_foreign_key_cascade_batch.apply_async(
            kwargs=dict(
                app_name=app_name, model_name=model_name, field_name=field_name, silo_mode=silo_mode
            ),
            countdown=15,
        )


def _process_tombstone_reconcilition(
    field: HybridCloudForeignKey,
    model: Any,
    tombstone_cls: Type[TombstoneBase],
    row_after_tombstone: bool,
) -> bool:
    from sentry import deletions

    prefix = "row" if row_after_tombstone else "tombstone"
    watermark_manager: Manager = (
        field.model.objects if row_after_tombstone else tombstone_cls.objects
    )
    watermark_target: str = "r" if row_after_tombstone else "t"

    low, up, has_more, tid = chunk_watermark_batch(
        prefix, field, watermark_manager, batch_size=3000
    )
    to_delete_ids: List[int]
    if low < up:
        to_delete_ids = [
            r.id
            for r in model.objects.raw(
                f"""
        SELECT r.id FROM {model._meta.db_table} r LEFT JOIN {tombstone_cls._meta.db_table} t
            ON t.table_name = %(table_name)s AND t.object_identifier = r.{field.name}
            WHERE {watermark_target}.id > %(low)s AND {watermark_target}.id <= %(up)s
        """,
                {
                    "table_name": field.foreign_table_name,
                    "low": low,
                    "up": up,
                },
            )
        ]

        if field.on_delete == HybridCloudForeignKeyCascadeBehavior.CASCADE:
            task = deletions.get(
                model=model,
                query={"id__in": to_delete_ids},
                transaction_id=tid,
            )

            if task.chunk():
                has_more = True  # The current batch is not complete, rerun this task again
            else:
                set_watermark(prefix, field, up, tid)

        elif field.on_delete == HybridCloudForeignKeyCascadeBehavior.SET_NULL:
            model.objects.filter(id__in=to_delete_ids).update({field.name: None})
            set_watermark(prefix, field, up, tid)

        else:
            raise ValueError(
                f"{field.model.__name__}.{field.name} has unexpected on_delete={field.on_delete}, could not process delete!"
            )

    return has_more
