from __future__ import absolute_import

import itertools
from hashlib import md5

from rest_framework.response import Response

from sentry import status_checks
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class SystemHealthEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        results = status_checks.check_all()
        return Response({
            'problems': map(
                lambda problem: {
                    'id': md5(problem.message).hexdigest(),
                    'message': problem.message,
                    'severity': problem.severity,
                    'url': problem.url,
                },
                sorted(itertools.chain.from_iterable(results.values()), reverse=True),
            ),
            'healthy': {type(check).__name__: not problems for check, problems in results.items()},
        })
