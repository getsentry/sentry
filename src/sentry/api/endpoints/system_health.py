import itertools

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry import status_checks
from sentry.api.base import Endpoint
from sentry.auth.superuser import is_active_superuser
from sentry.status_checks import sort_by_severity
from sentry.utils.hashlib import md5_text


class SystemHealthEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
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
