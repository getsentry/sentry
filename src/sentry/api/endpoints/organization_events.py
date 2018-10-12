from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from functools32 import partial

from sentry import roles
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import SnubaEvent
from sentry.models import OrganizationMember, OrganizationMemberTeam, Project, ProjectStatus
from sentry.utils.snuba import raw_query


class OrganizationEventsEndpoint(OrganizationEndpoint):

    def get_project_ids(self, request, organization):
        om_role = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
        ).values_list('role', flat=True).get()

        if request.user.is_superuser or (om_role and roles.get(om_role).is_global):
            qs = Project.objects.filter(
                organization=organization,
                status=ProjectStatus.VISIBLE,
            )
        else:
            qs = Project.objects.filter(
                organization=organization,
                teams__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=request.user,
                    organizationmember__organization=organization,
                ).values_list('team'),
                status=ProjectStatus.VISIBLE,
            )

        return list(qs.values_list('id', flat=True))

    def get(self, request, organization):
        query = request.GET.get('query')
        conditions = []
        if query:
            conditions.append(['message', 'LIKE', '%%%s%%' % (query,)])

        now = timezone.now()

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            start=now - timedelta(days=90),
            end=now,
            conditions=conditions,
            filter_keys={'project_id': self.get_project_ids(request, organization)},
            selected_columns=SnubaEvent.selected_columns,
            orderby='-timestamp',
        )

        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )
