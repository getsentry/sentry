from __future__ import annotations
from typing import int

import logging
from uuid import uuid4

from django.db import router, transaction

from sentry.db.models.base import Model
from sentry.models.options.organization_option import OrganizationOption

logger = logging.getLogger("sentry.deletions")


def build_pending_deletion_key(m: Model) -> str:
    return f"pending-delete:{type(m).__name__}:{m.id}"


def _pending_deletion_option(organization_id: int, m: Model) -> OrganizationOption:
    return OrganizationOption.objects.get(
        organization_id=organization_id, key=build_pending_deletion_key(m)
    )


def rename_on_pending_deletion(
    organization_id: int,
    m: Model,
    fields: tuple[str, ...],
    *,
    extra_fields_to_save: tuple[str, ...] = (),
) -> None:
    """
    `fields` represents the fields that should be renamed when pending deletion occurs.

    See the Repository Model for an example.
    """
    original_data = {"id": m.id, "model": type(m).__name__}

    for field in fields:
        original_data[field] = getattr(m, field)
        setattr(m, field, uuid4().hex)

    with transaction.atomic(router.db_for_write(type(m))):
        m.save(update_fields=[*fields, *extra_fields_to_save])
        OrganizationOption.objects.update_or_create(
            organization_id=organization_id,
            key=build_pending_deletion_key(m),
            defaults=dict(value=original_data),
        )

    logger.info(
        "rename-on-pending-deletion",
        extra={
            "organization_id": organization_id,
            "model": original_data["model"],
            "id": original_data["id"],
        },
    )


def reset_pending_deletion_field_names(
    organization_id: int,
    m: Model,
    fields: tuple[str, ...],
    *,
    extra_fields_to_save: tuple[str, ...] = (),
) -> bool:
    """
    See the Repository Model for an example.
    """
    try:
        option = _pending_deletion_option(organization_id, m)
    except OrganizationOption.DoesNotExist:
        logger.info(
            "reset-on-pending-deletion.does-not-exist",
            extra={
                "organization_id": organization_id,
                "model": type(m).__name__,
                "id": m.id,
            },
        )
        return False

    fields_to_save = []

    assert isinstance(option.value, dict)
    for field_name, field_value in option.value.items():
        if field_name in ("id", "model"):
            continue
        fields_to_save.append(field_name)
        setattr(m, field_name, field_value)

    m.save(update_fields=[*fields_to_save, *extra_fields_to_save])

    logger.info(
        "reset-on-pending-deletion.success",
        extra={
            "organization_id": organization_id,
            "model": type(m).__name__,
            "id": m.id,
        },
    )
    return True


def delete_pending_deletion_option(organization_id: int, m: Model) -> None:
    try:
        option = _pending_deletion_option(organization_id, m)
    except OrganizationOption.DoesNotExist:
        return
    option.delete()
    logger.info(
        "delete-pending-deletion-option.success",
        extra={
            "organization_id": organization_id,
            "model": type(m).__name__,
            "id": m.id,
        },
    )
