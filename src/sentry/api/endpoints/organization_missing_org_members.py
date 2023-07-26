from datetime import timedelta

from django.db.models import Count, QuerySet
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import Serializer, serialize
from sentry.models import Repository
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization


class MissingOrgMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {"email": obj.email, "externalId": obj.external_id, "commitCount": obj.commit_count}


class MissingMembersPermission(OrganizationPermission):
    scope_map = {"GET": ["org:write"]}


@region_silo_endpoint
class OrganizationMissingMembersEndpoint(OrganizationEndpoint):
    permission_classes = (MissingMembersPermission,)

    def _get_missing_members(self, organization: Organization) -> QuerySet[CommitAuthor]:
        member_emails = set(
            organization.member_set.exclude(email=None).values_list("email", flat=True)
        )
        member_emails.update(
            set(
                organization.member_set.exclude(user_email=None).values_list(
                    "user_email", flat=True
                )
            )
        )
        nonmember_authors = CommitAuthor.objects.filter(organization_id=organization.id).exclude(
            email__in=member_emails
        )

        org_repos = Repository.objects.filter(
            provider="integrations:github", organization_id=organization.id
        ).values_list("id", flat=True)

        # This is currently for Github only
        return (
            nonmember_authors.filter(
                commit__repository_id__in=set(org_repos),
                commit__date_added__gte=timezone.now() - timedelta(days=30),
            )
            .annotate(commit_count=Count("commit"))
            .order_by("-commit_count")
        )

    # TODO(cathy): check domain

    def get(self, request: Request, organization) -> Response:
        # TODO(cathy): search
        queryset = self._get_missing_members(organization)

        return Response(
            [
                {
                    "integration": "github",
                    "users": serialize(
                        list(queryset), request.user, serializer=MissingOrgMemberSerializer()
                    ),
                }
            ],
            status=status.HTTP_200_OK,
        )
