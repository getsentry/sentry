import itertools

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import status_checks
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.auth.superuser import is_active_superuser
from sentry.ratelimits.config import RateLimitConfig
from sentry.status_checks import sort_by_severity
from sentry.utils.hashlib import md5_text


@all_silo_endpoint
class SystemHealthEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.HYBRID_CLOUD
    permission_classes = (SentryIsAuthenticated,)
    rate_limits = RateLimitConfig(group="INTERNAL")

    def get(self, request: Request) -> Response:
        if not is_active_superuser(request):
            return Response()

        results = status_checks.check_all()
        return Response(
            {
                "problems": [
                    {
                        "id": md5_text(problem.message).hexdigest(),
                        "message": problem.message,
                        "severity": problem.severity,
                        "url": problem.url,
                    }
                    for problem in sort_by_severity(itertools.chain.from_iterable(results.values()))
                ],
                "healthy": {
                    type(check).__name__: not problems for check, problems in results.items()
                },
            }
        )
