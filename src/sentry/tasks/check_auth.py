import logging
from datetime import timedelta

from django.utils import timezone

from sentry.auth.exceptions import IdentityNotValid
from sentry.models import AuthIdentity, OrganizationMember
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger("sentry.auth")

AUTH_CHECK_INTERVAL = 3600


@instrumented_task(name="sentry.tasks.check_auth", queue="auth")
def check_auth(**kwargs):
    """
    Iterates over all accounts which have not been verified in the required
    interval and creates a new job to verify them.
    """
    # TODO(dcramer): we should remove identities if they've been inactivate
    # for a reasonable interval
    now = timezone.now()
    chunk_size = 100
    cutoff = now - timedelta(seconds=AUTH_CHECK_INTERVAL)
    identity_ids_list = list(
        AuthIdentity.objects.using_replica()
        .filter(last_synced__lte=cutoff)
        .values_list("id", flat=True)
    )
    for n in range(0, len(identity_ids_list), chunk_size):
        identity_ids_chunk = identity_ids_list[n : n + chunk_size]
        AuthIdentity.objects.filter(id__in=identity_ids_chunk).update(last_synced=now)
        for identity_id in identity_ids_chunk:
            check_auth_identity.apply_async(
                kwargs={"auth_identity_id": identity_id}, expires=AUTH_CHECK_INTERVAL
            )


@instrumented_task(name="sentry.tasks.check_auth_identity", queue="auth")
def check_auth_identity(auth_identity_id, **kwargs):
    try:
        auth_identity = AuthIdentity.objects.get(id=auth_identity_id)
    except AuthIdentity.DoesNotExist:
        logger.warning("AuthIdentity(id=%s) does not exist", auth_identity_id)
        return

    auth_provider = auth_identity.auth_provider

    try:
        om = OrganizationMember.objects.get(
            user=auth_identity.user, organization=auth_provider.organization_id
        )
    except OrganizationMember.DoesNotExist:
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
        setattr(om.flags, "sso:linked", is_linked)
        setattr(om.flags, "sso:invalid", not is_valid)
        om.update(flags=om.flags)

    now = timezone.now()
    auth_identity.update(last_verified=now, last_synced=now)
