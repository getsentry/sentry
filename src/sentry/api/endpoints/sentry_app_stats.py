from __future__ import absolute_import

from rest_framework.response import Response

from django.db import connection

from sentry.app import tsdb

from sentry.api.base import StatsMixin
from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission

query = """
select date_added, date_deleted, organization_id
from sentry_sentryappinstallation
where sentry_app_id = %s
and date_added between %s and %s
"""


class SentryAppStatsEndpoint(SentryAppBaseEndpoint, StatsMixin):
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request, sentry_app):
        """
        :qparam float since
        :qparam float until
        :qparam resolution - optional
        """

        query_args = self._parse_args(request)

        cursor = connection.cursor()
        cursor.execute(query, [sentry_app.id, query_args["start"], query_args["end"]])
        installations = cursor.fetchall()

        rollup, series = tsdb.get_optimal_rollup_series(query_args["start"], query_args["end"])

        install_counter = 0
        uninstall_counter = 0

        install_stats = dict.fromkeys(series, 0)
        uninstall_stats = dict.fromkeys(series, 0)

        for date_added, date_deleted, organization_id in installations:
            install_counter += 1
            install_norm_epoch = tsdb.normalize_to_epoch(date_added, rollup)

            if install_norm_epoch in install_stats:
                install_stats[install_norm_epoch] += 1
            if date_deleted is not None:
                uninstall_counter += 1
                uninstall_norm_epoch = tsdb.normalize_to_epoch(date_deleted, rollup)
                if uninstall_norm_epoch in uninstall_stats:
                    uninstall_stats[uninstall_norm_epoch] += 1

        result = {
            "total_installs": install_counter,
            "total_uninstalls": uninstall_counter,
            "install_stats": sorted(install_stats.items(), key=lambda x: x[0]),
            "uninstall_stats": sorted(uninstall_stats.items(), key=lambda x: x[0]),
        }

        return Response(result)
