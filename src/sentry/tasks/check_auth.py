from __future__ import annotations

import logging
from datetime import timedelta
from random import randrange
from typing import List

from django.db import router
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry.auth import find_providers_requiring_refresh
from sentry.auth.exceptions import IdentityNotValid
from sentry.models.authidentity import AuthIdentity
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organization import RpcOrganizationMember, organization_service
from sentry.silo import unguarded_write
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.env import in_test_environment

logger = logging.getLogger("sentry.auth")

AUTH_CHECK_INTERVAL = 3600 * 24
AUTH_CHECK_SKEW = 3600 * 2


@instrumented_task(name="sentry.tasks.check_auth", queue="auth.control", silo_mode=SiloMode.CONTROL)
def check_auth(chunk_size=100, **kwargs):
    """
    Checks for batches of auth identities and schedules them to refresh in a batched job.
    That batched job can recursively trigger check_auth to continue processing auth identities if necessary.
    Updates last_synced as it schedules batches so that further calls generally select non overlapping batches.
    """
    # TODO(dcramer): we should remove identities if they've been inactivate
    # for a reasonable interval
    now = timezone.now()
    cutoff = now - timedelta(seconds=AUTH_CHECK_INTERVAL - randrange(AUTH_CHECK_SKEW))
    identity_ids_list = list(
        AuthIdentity.objects.using_replica()
        .filter(last_synced__lte=cutoff)
        .values_list("id", flat=True)[:chunk_size]
    )

    if identity_ids_list:
        with unguarded_write(router.db_for_write(AuthIdentity)):
            AuthIdentity.objects.filter(id__in=identity_ids_list).update(last_synced=now)
        check_auth_identities.apply_async(
            kwargs={"auth_identity_ids": identity_ids_list, "chunk_size": chunk_size},
            expires=AUTH_CHECK_INTERVAL - AUTH_CHECK_SKEW,
        )


# Deprecate after roll out
@instrumented_task(
    name="sentry.tasks.check_auth_identity", queue="auth.control", silo_mode=SiloMode.CONTROL
)
def check_auth_identity(auth_identity_id: int, **kwargs):
    check_single_auth_identity(auth_identity_id)


@instrumented_task(
    name="sentry.tasks.check_auth_identities", queue="auth.control", silo_mode=SiloMode.CONTROL
)
def check_auth_identities(
    auth_identity_id: int | None = None,
    auth_identity_ids: List[int] | None = None,
    chunk_size=100,
    **kwargs,
):
    if auth_identity_ids is None and isinstance(auth_identity_id, int):
        auth_identity_ids = [auth_identity_id]

    if auth_identity_ids is not None:
        for ai_id in auth_identity_ids:
            try:
                check_single_auth_identity(ai_id)
            except Exception:
                capture_exception()
                if in_test_environment():
                    raise

    # Reschedule to search for more chunks to process.
    check_auth.apply_async(kwargs={"chunk_size": chunk_size})


def check_single_auth_identity(auth_identity_id: int):
    try:
        auth_identity = AuthIdentity.objects.get(id=auth_identity_id)
    except AuthIdentity.DoesNotExist:
        logger.warning("AuthIdentity(id=%s) does not exist", auth_identity_id)
        return

    auth_provider = auth_identity.auth_provider
    if auth_provider.provider not in find_providers_requiring_refresh():
        # This provider does not currently require refresh, don't bother working it.
        return

    om: RpcOrganizationMember | None = organization_service.check_membership_by_id(
        organization_id=auth_provider.organization_id, user_id=auth_identity.user_id
    )
    if om is None:
        logger.warning(
            "Removing invalid AuthIdentity(id=%s) due to no organization access", auth_identity_id
        )
        auth_identity.delete()
        return

    prev_is_valid = not getattr(om.flags, "sso:invalid")

    provider = auth_provider.get_provider()
    try:
        provider.refresh_identity(auth_identity)
    except IdentityNotValid as exc:
        if prev_is_valid:
            logger.warning(
                "AuthIdentity(id=%s) notified as not valid: %s",
                auth_identity_id,
                str(exc),
                exc_info=True,
            )
            metrics.incr("auth.identities.invalidated", skip_internal=False)
        is_linked = False
        is_valid = False
    except Exception as exc:
        # to ensure security we count any kind of error as an invalidation
        # event
        metrics.incr("auth.identities.refresh_error", skip_internal=False)
        logger.exception(
            "AuthIdentity(id=%s) returned an error during validation: %s",
            auth_identity_id,
            str(exc),
        )
        is_linked = True
        is_valid = False
    else:
        is_linked = True
        is_valid = True

    if getattr(om.flags, "sso:linked") != is_linked:
        with unguarded_write(using=router.db_for_write(OrganizationMemberMapping)):
            # flags are not replicated, so it's ok not to create outboxes here.
            setattr(om.flags, "sso:linked", is_linked)
            setattr(om.flags, "sso:invalid", not is_valid)
            organization_service.update_membership_flags(organization_member=om)

    now = timezone.now()
    auth_identity.update(last_verified=now, last_synced=now)
