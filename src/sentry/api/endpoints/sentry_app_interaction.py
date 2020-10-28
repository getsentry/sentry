from __future__ import absolute_import

from rest_framework.response import Response

import logging

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission

logger = logging.getLogger(__name__)

TSDB_MODELS = [tsdb.models.sentry_app_viewed, tsdb.models.sentry_app_component_interacted]
COMPONENT_TYPES = ["stacktrace-link", "issue-link"]


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
                "componentInteractions": {
                    k.split(":")[1]: v for k, v in component_interactions.items()
                },
            }
        )

    def post(self, request, sentry_app):
        """
        Increment a TSDB metric relating to Sentry App interactions

        :param string tsdbField         the name of the TSDB model to increment
        :param string componentType     required for 'sentry_app_component_interacted' metric
        """
        # Request should have identifier field stored in TSDBModel
        tsdb_field = request.data.get("tsdbField", "")

        model = getattr(tsdb.models, tsdb_field, None)
        if model is None or model not in TSDB_MODELS:
            return Response(
                {
                    "detail": "The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted"
                },
                status=400,
            )

        if model == tsdb.models.sentry_app_component_interacted:
            component_type = request.data.get("componentType", None)
            if component_type is None or component_type not in COMPONENT_TYPES:
                return Response(
                    {
                        "detail": "The field componentType is required and must be one of %s"
                        % (COMPONENT_TYPES)
                    },
                    status=400,
                )

            key = get_component_interaction_key(sentry_app, request.data["componentType"])
        elif model == tsdb.models.sentry_app_viewed:
            key = sentry_app.id

        # Timestamp is automatically created
        tsdb.incr(model, key)

        return Response({}, status=201)
