from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import analytics, features, options, roles
from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.paginator import DateTimePaginator, OffsetPaginator
from sentry.api.serializers import serialize
from sentry.app import ratelimiter
from sentry.auth.superuser import is_active_superuser
from sentry.db.models.query import in_iexact
from sentry.models import (
    AuditLogEntryEvent,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    ProjectPlatform,
)
from sentry.search.utils import tokenize_query
from sentry.signals import terms_accepted


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=True)
    slug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50, required=False)
    defaultTeam = serializers.BooleanField(required=False)
    agreeTerms = serializers.BooleanField(required=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not (settings.TERMS_URL and settings.PRIVACY_URL):
            del self.fields["agreeTerms"]

    def validate_agreeTerms(self, value):
        if not value:
            raise serializers.ValidationError("This attribute is required.")
        return value


class OrganizationIndexEndpoint(Endpoint):
    permission_classes = (OrganizationPermission,)

    def get(self, request):
        """
        List your Organizations
        ```````````````````````

        Return a list of organizations available to the authenticated
        session.  This is particularly useful for requests with an
        user bound context.  For API key based requests this will
        only return the organization that belongs to the key.

        :qparam bool owner: restrict results to organizations in which you are
                            an organization owner

        :auth: required
        """
        owner_only = request.GET.get("owner") in ("1", "true")

        queryset = Organization.objects.distinct()

        if request.auth and not request.user.is_authenticated():
            if hasattr(request.auth, "project"):
                queryset = queryset.filter(id=request.auth.project.organization_id)
            elif request.auth.organization is not None:
                queryset = queryset.filter(id=request.auth.organization.id)

        elif owner_only:
            # This is used when closing an account
            queryset = queryset.filter(
                member_set__role=roles.get_top_dog().id,
                member_set__user=request.user,
                status=OrganizationStatus.VISIBLE,
            )
            org_results = []
            for org in sorted(queryset, key=lambda x: x.name):
                # O(N) query
                org_results.append(
                    {"organization": serialize(org), "singleOwner": org.has_single_owner()}
                )

            return Response(org_results)

        elif not (is_active_superuser(request) and request.GET.get("show") == "all"):
            queryset = queryset.filter(
                id__in=OrganizationMember.objects.filter(user=request.user).values("organization")
            )

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value)
                        | Q(slug__icontains=value)
                        | Q(members__email__iexact=value)
                    )
                elif key == "slug":
                    queryset = queryset.filter(in_iexact("slug", value))
                elif key == "email":
                    queryset = queryset.filter(in_iexact("members__email", value))
                elif key == "platform":
                    queryset = queryset.filter(
                        project__in=ProjectPlatform.objects.filter(platform__in=value).values(
                            "project_id"
                        )
                    )
                elif key == "id":
                    queryset = queryset.filter(id__in=value)
                elif key == "status":
                    try:
                        queryset = queryset.filter(
                            status__in=[OrganizationStatus[v.upper()] for v in value]
                        )
                    except KeyError:
                        queryset = queryset.none()
                elif key == "member_id":
                    queryset = queryset.filter(
                        id__in=OrganizationMember.objects.filter(id__in=value).values(
                            "organization"
                        )
                    )
                else:
                    queryset = queryset.none()

        sort_by = request.GET.get("sortBy")
        if sort_by == "members":
            queryset = queryset.annotate(member_count=Count("member_set"))
            order_by = "-member_count"
            paginator_cls = OffsetPaginator
        elif sort_by == "projects":
            queryset = queryset.annotate(project_count=Count("project"))
            order_by = "-project_count"
            paginator_cls = OffsetPaginator
        elif sort_by == "events":
            queryset = queryset.annotate(event_count=Sum("stats__events_24h")).filter(
                stats__events_24h__isnull=False
            )
            order_by = "-event_count"
            paginator_cls = OffsetPaginator
        else:
            order_by = "-date_added"
            paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=paginator_cls,
        )

    # XXX: endpoint useless for end-users as it needs user context.
    def post(self, request):
        """
        Create a New Organization
        `````````````````````````

        Create a new organization owned by the request's user.  To create
        an organization only the name is required.

        :param string name: the human readable name for the new organization.
        :param string slug: the unique URL slug for this organization.  If
                            this is not provided a slug is automatically
                            generated based on the name.
        :param bool agreeTerms: a boolean signaling you agree to the applicable
                                terms of service and privacy policy.
        :auth: required, user-context-needed
        """
        if not request.user.is_authenticated():
            return Response({"detail": "This endpoint requires user info"}, status=401)

        if not features.has("organizations:create", actor=request.user):
            return Response(
                {"detail": "Organizations are not allowed to be created by this user."}, status=401
            )

        limit = options.get("api.rate-limit.org-create")
        if limit and ratelimiter.is_limited(
            f"org-create:{request.user.id}", limit=limit, window=3600
        ):
            return Response(
                {"detail": "You are attempting to create too many organizations too quickly."},
                status=429,
            )

        serializer = OrganizationSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            try:
                with transaction.atomic():
                    org = Organization.objects.create(name=result["name"], slug=result.get("slug"))

                    om = OrganizationMember.objects.create(
                        organization=org, user=request.user, role=roles.get_top_dog().id
                    )

                    if result.get("defaultTeam"):
                        team = org.team_set.create(name=org.name)

                        OrganizationMemberTeam.objects.create(
                            team=team, organizationmember=om, is_active=True
                        )

                    self.create_audit_entry(
                        request=request,
                        organization=org,
                        target_object=org.id,
                        event=AuditLogEntryEvent.ORG_ADD,
                        data=org.get_audit_log_data(),
                    )

                    analytics.record(
                        "organization.created",
                        org,
                        actor_id=request.user.id if request.user.is_authenticated() else None,
                    )

            except IntegrityError:
                return Response(
                    {"detail": "An organization with this slug already exists."}, status=409
                )

            # failure on sending this signal is acceptable
            if result.get("agreeTerms"):
                terms_accepted.send_robust(
                    user=request.user,
                    organization=org,
                    ip_address=request.META["REMOTE_ADDR"],
                    sender=type(self),
                )

            return Response(serialize(org, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
