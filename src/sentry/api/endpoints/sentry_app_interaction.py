from __future__ import absolute_import

from rest_framework.response import Response

import logging

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission

logger = logging.getLogger(__name__)

TSDB_MODELS = [tsdb.models.sentry_app_viewed, tsdb.models.sentry_app_component_interacted]


def get_component_interaction_key(sentry_app, component_type):
    return "%s:%s" % (sentry_app.slug, component_type)


class SentryAppInteractionEndpoint(SentryAppBaseEndpoint, StatsMixin):
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request, sentry_app):
        """
        :qparam float since
        :qparam float until
        :qparam resolution - optional
        """

        views = tsdb.get_range(
            model=tsdb.models.sentry_app_viewed, keys=[sentry_app.id], **self._parse_args(request)
        )[sentry_app.id]

        component_interactions = tsdb.get_range(
            model=tsdb.models.sentry_app_component_interacted,
            keys=[
                get_component_interaction_key(sentry_app, component.type)
                for component in sentry_app.components.all()
            ],
            **self._parse_args(request)
        )

        return Response(
            {
                "views": views,
                "component_interactions": {
                    k.split(":")[1]: v for k, v in component_interactions.items()
                },
            }
        )

    def post(self, request, sentry_app):
        # Request should have identifier field stored in TSDBModel
        tsdb_field = request.data.get("tsdbField")

        model = getattr(tsdb.models, tsdb_field, None)
        if model is None or model not in TSDB_MODELS:
            return Response({"detail": "Invalid TSDB field name"}, status=400)

        if model == tsdb.models.sentry_app_component_interacted:
            try:
                key = get_component_interaction_key(sentry_app, request.data["componentType"])
            except KeyError:
                return Response({"detail": "Sentry App component type required"}, status=400)
        elif model == tsdb.models.sentry_app_viewed:
            key = sentry_app.id

        # Timestamp is automatically created
        tsdb.incr(model, key)

        return Response({}, status=201)
