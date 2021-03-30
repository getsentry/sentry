from django.db.models import Q
from django.db.models.query import EmptyQuerySet
from rest_framework.exceptions import AuthenticationFailed

from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import ProjectWithOrganizationSerializer, serialize
from sentry.auth.superuser import is_active_superuser
from sentry.db.models.query import in_iexact
from sentry.models import Project, ProjectPlatform, ProjectStatus, SentryAppInstallationToken
from sentry.search.utils import tokenize_query


class ProjectIndexEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def get(self, request):
        """
        List your Projects
        ``````````````````

        Return a list of projects available to the authenticated
        session.

        :auth: required
        """
        queryset = Project.objects.select_related("organization").distinct()

        status = request.GET.get("status", "active")
        if status == "active":
            queryset = queryset.filter(status=ProjectStatus.VISIBLE)
        elif status == "deleted":
            queryset = queryset.exclude(status=ProjectStatus.VISIBLE)
        elif status:
            queryset = queryset.none()

        if request.auth and not request.user.is_authenticated():
            if hasattr(request.auth, "project"):
                queryset = queryset.filter(id=request.auth.project_id)
            elif request.auth.organization is not None:
                queryset = queryset.filter(organization=request.auth.organization.id)
            else:
                queryset = queryset.none()
        elif not (is_active_superuser(request) and request.GET.get("show") == "all"):
            if request.user.is_sentry_app:
                queryset = SentryAppInstallationToken.get_projects(request.auth)
                if isinstance(queryset, EmptyQuerySet):
                    raise AuthenticationFailed("Token not found")
            else:
                queryset = queryset.filter(teams__organizationmember__user=request.user)

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                elif key == "slug":
                    queryset = queryset.filter(in_iexact("slug", value))
                elif key == "name":
                    queryset = queryset.filter(in_iexact("name", value))
                elif key == "platform":
                    queryset = queryset.filter(
                        id__in=ProjectPlatform.objects.filter(platform__in=value).values(
                            "project_id"
                        )
                    )
                elif key == "id":
                    queryset = queryset.filter(id__in=value)
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, ProjectWithOrganizationSerializer()),
            paginator_cls=DateTimePaginator,
        )
