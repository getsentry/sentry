from __future__ import annotations

from logging import Logger
from typing import Any

from django.http.request import HttpRequest

from sentry import audit_log
from sentry.audit_log.services.log import log_service
from sentry.models.apikey import ApiKey
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.deletedentry import DeletedEntry
from sentry.models.deletedorganization import DeletedOrganization
from sentry.models.deletedproject import DeletedProject
from sentry.models.deletedteam import DeletedTeam
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.organizations.services.organization.model import RpcAuditLogEntryActor
from sentry.silo.base import region_silo_function
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


def create_audit_entry(
    request: HttpRequest,
    transaction_id: int | str | None = None,
    logger: Logger | None = None,
    **kwargs: Any,
) -> AuditLogEntry:
    user = kwargs.pop("actor", request.user if request.user.is_authenticated else None)
    api_key = get_api_key_for_audit_log(request)
    org_auth_token = get_org_auth_token_for_audit_log(request)

    # We do not keep any user/key ID for this case for now, but only pass the token name as a label
    # Without this, the AuditLogEntry fails on save because it cannot find an actor_label
    if org_auth_token:
        kwargs["actor_label"] = org_auth_token.name

    return create_audit_entry_from_user(
        user, api_key, request.META["REMOTE_ADDR"], transaction_id, logger, **kwargs
    )


def actor_from_audit_entry(entry: AuditLogEntry) -> RpcAuditLogEntryActor:
    return RpcAuditLogEntryActor(
        actor_label=entry.actor_label[:64] if entry.actor_label else None,
        actor_id=entry.actor_id,
        actor_key=entry.actor_key,
        ip_address=entry.ip_address,
    )


def _org_id(org: Organization | RpcOrganization | None, org_id: int | None) -> int:
    if org is not None and org_id is not None:
        raise TypeError("expected organization=... or organization_id=... not both!")
    elif org is not None:
        return org.id
    elif org_id is not None:
        return org_id
    else:
        raise TypeError("expected organization=... or organization_id=...")


def create_audit_entry_from_user(
    user: User | RpcUser | None,
    api_key: ApiKey | None = None,
    ip_address: str | None = None,
    transaction_id: int | str | None = None,
    logger: Logger | None = None,
    organization: Organization | RpcOrganization | None = None,
    organization_id: int | None = None,
    **kwargs: Any,
) -> AuditLogEntry:
    organization_id = _org_id(organization, organization_id)
    assert user is not None or api_key is not None or ip_address is not None

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
        organization_service.create_org_delete_log(
            organization_id=organization_id, audit_log_actor=actor_from_audit_entry(entry)
        )
    elif entry.event == audit_log.get_event_id(
        "PROJECT_REMOVE"
    ) or entry.event == audit_log.get_event_id("PROJECT_REMOVE_WITH_ORIGIN"):
        _create_project_delete_log(entry=entry, audit_log_actor=actor_from_audit_entry(entry))

    elif entry.event == audit_log.get_event_id("TEAM_REMOVE"):
        _create_team_delete_log(entry=entry, audit_log_actor=actor_from_audit_entry(entry))

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


def get_api_key_for_audit_log(request: HttpRequest) -> ApiKey | None:
    return request.auth if hasattr(request, "auth") and isinstance(request.auth, ApiKey) else None


def get_org_auth_token_for_audit_log(request: HttpRequest) -> OrgAuthToken | None:
    return (
        request.auth
        if hasattr(request, "auth") and isinstance(request.auth, OrgAuthToken)
        else None
    )


@region_silo_function
def create_org_delete_log(organization_id: int, audit_log_actor: RpcAuditLogEntryActor) -> None:
    delete_log = DeletedOrganization()
    organization = Organization.objects.get(id=organization_id)

    delete_log.name = organization.name
    delete_log.slug = organization.slug
    delete_log.date_created = organization.date_added

    _complete_delete_log(delete_log=delete_log, audit_log_actor=audit_log_actor)


@region_silo_function
def _create_project_delete_log(
    entry: AuditLogEntry, audit_log_actor: RpcAuditLogEntryActor
) -> None:
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

    _complete_delete_log(delete_log=delete_log, audit_log_actor=audit_log_actor)


@region_silo_function
def _create_team_delete_log(entry: AuditLogEntry, audit_log_actor: RpcAuditLogEntryActor) -> None:
    delete_log = DeletedTeam()

    team = Team.objects.get(id=entry.target_object)
    delete_log.name = team.name
    delete_log.slug = team.slug
    delete_log.date_created = team.date_added

    organization = Organization.objects.get(id=entry.organization_id)
    delete_log.organization_id = organization.id
    delete_log.organization_name = organization.name
    delete_log.organization_slug = organization.slug

    _complete_delete_log(delete_log=delete_log, audit_log_actor=audit_log_actor)


@region_silo_function
def _complete_delete_log(delete_log: DeletedEntry, audit_log_actor: RpcAuditLogEntryActor) -> None:
    """
    Adds common information on a delete log from an audit entry and
    saves that delete log.
    """
    delete_log.actor_label = audit_log_actor.actor_label
    delete_log.actor_id = audit_log_actor.actor_id
    delete_log.actor_key = audit_log_actor.actor_key
    delete_log.ip_address = audit_log_actor.ip_address

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
    organization_id = _org_id(organization, organization_id)
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
