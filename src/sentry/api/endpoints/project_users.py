from rest_framework import status
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
            try:
                field, identifier = request.GET["query"].strip().split(":", 1)
            except ValueError:
                return Response([])
            # username and ip can return multiple eventuser objects
            if field in ("ip", "username"):
                queryset = queryset.filter(
                    project_id=project.id,
                    **{EventUser.attr_from_keyword(field): identifier},
                )
            else:
                try:
                    queryset = [
                        queryset.get(
                            project_id=project.id,
                            **{EventUser.attr_from_keyword(field): identifier},
                        )
                    ]
                except EventUser.DoesNotExist:
                    return Response(status=status.HTTP_404_NOT_FOUND)
                except KeyError:
                    return Response([])
                return Response(serialize(queryset, request.user))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=DateTimePaginator,
            on_results=lambda x: serialize(x, request.user),
        )
