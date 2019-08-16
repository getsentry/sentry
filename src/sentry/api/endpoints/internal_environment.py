from __future__ import absolute_import

import sys

from rest_framework.response import Response
from django.conf import settings

from sentry.app import env
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class InternalEnvironmentEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        reserved = ("PASSWORD", "SECRET", "KEY")
        config = []
        for k in sorted(dir(settings)):
            v_repr = repr(getattr(settings, k))
            if any(r.lower() in v_repr.lower() for r in reserved):
                v_repr = "*" * 16
            if any(r in k for r in reserved):
                v_repr = "*" * 16
            if k.startswith("_"):
                continue
            if k.upper() != k:
                continue
            config.append((k, v_repr))

        data = {"pythonVersion": sys.version, "config": config, "environment": env.data}

        return Response(data)
