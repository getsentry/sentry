from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, features, options
from sentry import ratelimits as ratelimiter
from sentry import roles
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.paginator import DateTimePaginator, OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import BaseOrganizationSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.db.models.query import in_iexact
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    ProjectPlatform,
)
from sentry.search.utils import tokenize_query
from sentry.services.hybrid_cloud import IDEMPOTENCY_KEY_LENGTH
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.signals import org_setup_complete, terms_accepted


class OrganizationSerializer(BaseOrganizationSerializer):
    defaultTeam = serializers.BooleanField(required=False)
    agreeTerms = serializers.BooleanField(required=True)
    idempotencyKey = serializers.CharField(max_length=IDEMPOTENCY_KEY_LENGTH, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not (settings.TERMS_URL and settings.PRIVACY_URL):
            del self.fields["agreeTerms"]
        self.fields["slug"].required = False
        self.fields["name"].required = True

    def validate_agreeTerms(self, value):
        if not value:
            raise serializers.ValidationError("This attribute is required.")
        return value


@region_silo_endpoint
class OrganizationIndexEndpoint(Endpoint):
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request) -> Response:
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

        if request.auth and not request.user.is_authenticated:
            if hasattr(request.auth, "project"):
                queryset = queryset.filter(id=request.auth.project.organization_id)
            elif request.auth.organization_id is not None:
                queryset = queryset.filter(id=request.auth.organization_id)

        elif owner_only:
            # This is used when closing an account

            # also fetches organizations in which you are a member of an owner team
            queryset = Organization.objects.get_organizations_where_user_is_owner(
                user_id=request.user.id
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
                id__in=OrganizationMember.objects.filter(user_id=request.user.id).values(
                    "organization"
                )
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
    def post(self, request: Request) -> Response:
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
        if not request.user.is_authenticated:
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

                    organization_mapping_service.create(
                        organization_id=org.id,
                        slug=org.slug,
                        name=org.name,
                        idempotency_key=result.get("idempotencyKey", ""),
                        region_name=settings.SENTRY_REGION or "us",
                    )
                    rpc_org_member = organization_service.add_organization_member(
                        organization_id=org.id,
                        default_org_role=org.default_role,
                        user_id=request.user.id,
                        role=roles.get_top_dog().id,
                    )
                    om = OrganizationMember.objects.get(id=rpc_org_member.id)

                    if result.get("defaultTeam"):
                        team = org.team_set.create(name=org.name)

                        OrganizationMemberTeam.objects.create(
                            team=team, organizationmember=om, is_active=True
                        )

                    org_setup_complete.send_robust(
                        instance=org, user=request.user, sender=self.__class__
                    )

                    self.create_audit_entry(
                        request=request,
                        organization=org,
                        target_object=org.id,
                        event=audit_log.get_event_id("ORG_ADD"),
                        data=org.get_audit_log_data(),
                    )

                    analytics.record(
                        "organization.created",
                        org,
                        actor_id=request.user.id if request.user.is_authenticated else None,
                    )

            # TODO(hybrid-cloud): We'll need to catch a more generic error
            # when the internal RPC is implemented.
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
