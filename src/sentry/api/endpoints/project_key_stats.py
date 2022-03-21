from collections import OrderedDict

from django.db.models import F
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ProjectKey
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class ProjectKeyStatsEndpoint(ProjectEndpoint, StatsMixin):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(20, 1),
            RateLimitCategory.USER: RateLimit(20, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(20, 1),
        }
    }

    def get(self, request: Request, project, key_id) -> Response:
        try:
            key = ProjectKey.objects.get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            stat_args = self._parse_args(request)
        except ValueError:
            return Response({"detail": "Invalid request data"}, status=400)

        stats = OrderedDict()
        for model, name in (
            (tsdb.models.key_total_received, "total"),
            (tsdb.models.key_total_blacklisted, "filtered"),
            (tsdb.models.key_total_rejected, "dropped"),
        ):
            # XXX (alex, 08/05/19) key stats were being stored under either key_id or str(key_id)
            # so merge both of those back into one stats result.
            result = tsdb.get_range(model=model, keys=[key.id, str(key.id)], **stat_args)
            for key_id, points in result.items():
                for ts, count in points:
                    bucket = stats.setdefault(int(ts), {})
                    bucket.setdefault(name, 0)
                    bucket[name] += count

        return Response(
            [
                {
                    "ts": ts,
                    "total": data["total"],
                    "dropped": data["dropped"],
                    "filtered": data["filtered"],
                    "accepted": data["total"] - data["dropped"] - data["filtered"],
                }
                for ts, data in stats.items()
            ]
        )
