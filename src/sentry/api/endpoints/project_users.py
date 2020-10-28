from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models import EventUser


class ProjectUsersEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a Project's Users
        ``````````````````````

        Return a list of users seen within this project.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        :qparam string query: Limit results to users matching the given query.
                              Prefixes should be used to suggest the field to
                              match on: ``id``, ``email``, ``username``, ``ip``.
                              For example, ``query=email:foo@example.com``
        """
        queryset = EventUser.objects.filter(project_id=project.id)
        if request.GET.get("query"):
            pieces = request.GET["query"].strip().split(":", 1)
            if len(pieces) != 2:
                return Response([])
            try:
                queryset = queryset.filter(
                    **{u"{}__icontains".format(EventUser.attr_from_keyword(pieces[0])): pieces[1]}
                )
            except KeyError:
                return Response([])

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=DateTimePaginator,
            on_results=lambda x: serialize(x, request.user),
        )
