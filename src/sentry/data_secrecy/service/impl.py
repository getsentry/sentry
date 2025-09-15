from django.db import models
from django.utils import timezone

from sentry.data_secrecy.models.data_access_grant import DataAccessGrant
from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus
from sentry.data_secrecy.service.serial import serialize_effective_grant_status
from sentry.data_secrecy.service.service import DataAccessGrantService


class DatabaseBackedDataAccessGrantService(DataAccessGrantService):
    def get_effective_grant_status(self, *, organization_id: int) -> RpcEffectiveGrantStatus | None:
        """
        Get the effective grant status for an organization.
        """
        now = timezone.now()
        active_grants = DataAccessGrant.objects.filter(
            organization_id=organization_id,
            grant_start__lte=now,
            grant_end__gt=now,
            revocation_date__isnull=True,  # Not revoked
        )

        if not active_grants.exists():
            return None

        # Calculate aggregate grant status - only need the time window for access control
        min_start = active_grants.aggregate(min_start=models.Min("grant_start"))["min_start"]
        max_end = active_grants.aggregate(max_end=models.Max("grant_end"))["max_end"]

        grant_status = {
            "access_start": min_start.isoformat(),
            "access_end": max_end.isoformat(),
        }

        return serialize_effective_grant_status(grant_status, organization_id)
