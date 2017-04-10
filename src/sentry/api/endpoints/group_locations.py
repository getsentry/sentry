from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.paginator import DateTimePaginator, OffsetPaginator, Paginator
from sentry.api.serializers import serialize
from sentry.models import GroupTagValue


class GroupLocationsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group):
        queryset = GroupTagValue.objects.filter(
            group=group,
            key='location.country',
        )

        sort = request.GET.get('sort')
        if sort == 'date':
            order_by = '-last_seen'
            paginator_cls = DateTimePaginator
        elif sort == 'age':
            order_by = '-first_seen'
            paginator_cls = DateTimePaginator
        elif sort == 'freq':
            order_by = '-times_seen'
            paginator_cls = OffsetPaginator
        else:
            order_by = '-id'
            paginator_cls = Paginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            paginator_cls=paginator_cls,
            on_results=lambda x: serialize(x, request.user),
        )
