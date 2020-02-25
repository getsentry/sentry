from __future__ import absolute_import

import itertools
import six

from django.http import HttpResponse
from sentry.utils.compat import filter


class HealthCheck(object):
    def process_request(self, request):
        # Our health check can't be a done as a view, because we need
        # to bypass the ALLOWED_HOSTS check. We need to do this
        # since not all load balancers can send the expected Host header
        # which would cause a 400 BAD REQUEST, marking the node dead.
        # Instead, we just intercept the request at this point, and return
        # our success/failure immediately.
        if request.path != "/_health/":
            return

        if "full" not in request.GET:
            return HttpResponse("ok", content_type="text/plain")

        from sentry.status_checks import Problem, check_all
        from sentry.utils import json

        threshold = Problem.threshold(Problem.SEVERITY_CRITICAL)
        results = {check: filter(threshold, problems) for check, problems in check_all().items()}
        problems = list(itertools.chain.from_iterable(results.values()))

        return HttpResponse(
            json.dumps(
                {
                    "problems": [six.text_type(p) for p in problems],
                    "healthy": {type(check).__name__: not p for check, p in results.items()},
                }
            ),
            content_type="application/json",
            status=(500 if problems else 200),
        )
