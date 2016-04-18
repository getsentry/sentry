from __future__ import absolute_import

from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntry

EVENT_REVERSE_MAP = {
    v: k
    for k, v in AuditLogEntry._meta.get_field('event').choices
}


class OrganizationAuditLogsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        queryset = AuditLogEntry.objects.filter(
            organization=organization,
        ).select_related('actor')

        event = request.GET.get('event')
        if event:
            try:
                queryset = queryset.filter(
                    event=EVENT_REVERSE_MAP[event],
                )
            except KeyError:
                queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
        )
