from __future__ import annotations

from logging import Logger
from typing import Any

from rest_framework.request import Request

from sentry import audit_log
from sentry.models import (
    ApiKey,
    AuditLogEntry,
    DeletedEntry,
    DeletedOrganization,
    DeletedProject,
    DeletedTeam,
    Organization,
    Project,
    Team,
    User,
)
from sentry.services.hybrid_cloud.log import log_service
from sentry.services.hybrid_cloud.user import RpcUser


def create_audit_entry(
    request: Request,
    transaction_id: int | str | None = None,
    logger: Logger | None = None,
    **kwargs: Any,
) -> AuditLogEntry:
    user = kwargs.pop("actor", request.user if request.user.is_authenticated else None)
    api_key = get_api_key_for_audit_log(request)

    return create_audit_entry_from_user(
        user, api_key, request.META["REMOTE_ADDR"], transaction_id, logger, **kwargs
    )


def create_audit_entry_from_user(
    user: User | RpcUser | None,
    api_key: ApiKey | None = None,
    ip_address: str | None = None,
    transaction_id: int | str | None = None,
    logger: Logger | None = None,
    organization: Organization | None = None,
    organization_id: int | None = None,
    **kwargs: Any,
) -> AuditLogEntry:
    if organization:
        assert organization_id is None
        organization_id = organization.id

    entry = AuditLogEntry(
        actor_id=user.id if user else None,
        actor_key=api_key,
        ip_address=ip_address,
        organization_id=organization_id,
        **kwargs,
    )

    # Only create a real AuditLogEntry record if we are passing an event type
    # otherwise, we want to still log to our actual logging
    if entry.event is not None:
        log_service.record_audit_log(event=entry.as_event())

    if entry.event == audit_log.get_event_id("ORG_REMOVE"):
        _create_org_delete_log(entry)

    elif entry.event == audit_log.get_event_id(
        "PROJECT_REMOVE"
    ) or entry.event == audit_log.get_event_id("PROJECT_REMOVE_WITH_ORIGIN"):
        _create_project_delete_log(entry)

    elif entry.event == audit_log.get_event_id("TEAM_REMOVE"):
        _create_team_delete_log(entry)

    extra = {
        "ip_address": entry.ip_address,
        "organization_id": entry.organization_id,
        "object_id": entry.target_object,
        "entry_id": entry.id,
        "actor_label": entry.actor_label,
    }
    if entry.actor_id:
        extra["actor_id"] = entry.actor_id
    if entry.actor_key_id:
        extra["actor_key_id"] = entry.actor_key_id
    if transaction_id is not None:
        extra["transaction_id"] = transaction_id

    if logger:
        # Only use the api_name for the logger message when the entry
        # is a real AuditLogEntry record
        if entry.event is not None:
            logger.info(audit_log.get(entry.event).api_name, extra=extra)
        else:
            logger.info(entry, extra=extra)

    return entry


def get_api_key_for_audit_log(request: Request) -> ApiKey | None:
    return request.auth if hasattr(request, "auth") and isinstance(request.auth, ApiKey) else None


def _create_org_delete_log(entry: AuditLogEntry) -> None:
    delete_log = DeletedOrganization()
    organization = Organization.objects.get(id=entry.target_object)

    delete_log.name = organization.name
    delete_log.slug = organization.slug
    delete_log.date_created = organization.date_added

    _complete_delete_log(delete_log, entry)


def _create_project_delete_log(entry: AuditLogEntry) -> None:
    delete_log = DeletedProject()

    project = Project.objects.get(id=entry.target_object)
    delete_log.name = project.name
    delete_log.slug = project.slug
    delete_log.date_created = project.date_added
    delete_log.platform = project.platform

    organization = Organization.objects.get(id=entry.organization_id)
    delete_log.organization_id = organization.id
    delete_log.organization_name = organization.name
    delete_log.organization_slug = organization.slug

    _complete_delete_log(delete_log, entry)


def _create_team_delete_log(entry: AuditLogEntry) -> None:
    delete_log = DeletedTeam()

    team = Team.objects.get(id=entry.target_object)
    delete_log.name = team.name
    delete_log.slug = team.slug
    delete_log.date_created = team.date_added

    organization = Organization.objects.get(id=entry.organization_id)
    delete_log.organization_id = organization.id
    delete_log.organization_name = organization.name
    delete_log.organization_slug = organization.slug

    _complete_delete_log(delete_log, entry)


def _complete_delete_log(delete_log: DeletedEntry, entry: AuditLogEntry) -> None:
    """
    Adds common information on a delete log from an audit entry and
    saves that delete log.
    """
    delete_log.actor_label = entry.actor_label[:64]
    delete_log.actor_id = entry.actor_id
    delete_log.actor_key = entry.actor_key
    delete_log.ip_address = entry.ip_address
    delete_log.save()


def create_system_audit_entry(
    transaction_id: int | str | None = None,
    logger: Logger | None = None,
    organization: Organization | None = None,
    organization_id: int | None = None,
    **kwargs: Any,
) -> AuditLogEntry:
    """
    Creates an audit log entry for events that are triggered by Sentry's
    systems and do not have an associated Sentry user as the "actor".
    """
    if organization:
        assert organization_id is None
        organization_id = organization.id

    entry = AuditLogEntry(actor_label="Sentry", organization_id=organization_id, **kwargs)
    if entry.event is not None:
        log_service.record_audit_log(event=entry.as_event())

    extra = {
        "organization_id": entry.organization_id,
        "object_id": entry.target_object,
        "entry_id": entry.id,
        "actor_label": entry.actor_label,
    }
    if transaction_id is not None:
        extra["transaction_id"] = transaction_id

    if logger:
        # Only use the api_name for the logger message when the entry
        # is a real AuditLogEntry record
        if entry.event is not None:
            logger.info(audit_log.get(entry.event).api_name, extra=extra)
        else:
            logger.info(entry, extra=extra)

    return entry
