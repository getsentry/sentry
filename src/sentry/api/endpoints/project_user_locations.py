from __future__ import absolute_import

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import DateTimePaginator, OffsetPaginator, Paginator
from sentry.api.serializers import serialize
from sentry.models import EventUser, EventUserLocation


class ProjectUserLocationsEndpoint(ProjectEndpoint):
    def get(self, request, project, user_hash):
        euser = EventUser.objects.get(
            project=project,
            hash=user_hash,
        )

        other_eusers = euser.find_similar_users(request.user)
        event_users = [euser] + list(other_eusers)

        queryset = EventUserLocation.objects.filter(
            event_user_id__in=[e.id for e in event_users],
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
