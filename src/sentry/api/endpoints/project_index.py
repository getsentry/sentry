from django.db.models import Q
from django.db.models.query import EmptyQuerySet
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import ProjectWithOrganizationSerializer, serialize
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ObjectStatus
from sentry.db.models.query import in_iexact
from sentry.models import Project, ProjectPlatform
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.search.utils import tokenize_query


@region_silo_endpoint
class ProjectIndexEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def get(self, request: Request) -> Response:
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
            queryset = queryset.filter(status=ObjectStatus.ACTIVE)
        elif status == "deleted":
            queryset = queryset.exclude(status=ObjectStatus.ACTIVE)
        elif status:
            queryset = queryset.none()

        if request.auth and not request.user.is_authenticated:
            if hasattr(request.auth, "project"):
                queryset = queryset.filter(id=request.auth.project_id)
            elif request.auth.organization_id is not None:
                queryset = queryset.filter(organization_id=request.auth.organization_id)
            else:
                queryset = queryset.none()
        elif not (is_active_superuser(request) and request.GET.get("show") == "all"):
            if request.user.is_sentry_app:
                queryset = SentryAppInstallation.objects.get_projects(request.auth)
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
                elif key == "dsn":
                    queryset = queryset.filter(key_set__public_key__in=value)
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
