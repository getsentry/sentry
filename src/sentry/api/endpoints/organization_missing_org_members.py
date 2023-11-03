from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from email.headerregistry import Address
from functools import reduce
from typing import TYPE_CHECKING, Dict, Sequence

from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import Serializer, serialize
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationFeatures
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import integration_service

if TYPE_CHECKING:
    # XXX: this should use WithAnnotations but it breaks the cache typeddjango/django-stubs#760
    class CommitAuthor___commit__count(CommitAuthor):
        commit__count: int


FILTERED_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "icloud.com",
    "hotmail.com",
    "outlook.com",
    "noreply.github.com",
    "localhost",
}

FILTERED_CHARACTERS = {"+"}


class MissingOrgMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        formatted_external_id = _format_external_id(obj.external_id)

        return {
            "email": obj.email,
            "externalId": formatted_external_id,
            "commitCount": obj.commit__count,
        }


class MissingMembersPermission(OrganizationPermission):
    scope_map = {"GET": ["org:write"]}


def _format_external_id(external_id: str | None) -> str | None:
    formatted_external_id = external_id

    if external_id is not None and ":" in external_id:
        formatted_external_id = external_id.split(":")[1]

    return formatted_external_id


def _get_missing_organization_members(
    organization: Organization,
    provider: str,
    integration_ids: Sequence[int],
    shared_domain: str | None,
) -> QuerySet[CommitAuthor___commit__count]:
    member_emails = list(
        organization.member_set.exclude(email=None).values_list("email", flat=True)
    ) + list(organization.member_set.exclude(user_email=None).values_list("user_email", flat=True))

    nonmember_authors = CommitAuthor.objects.filter(organization_id=organization.id).exclude(
        Q(email__in=member_emails) | Q(external_id=None)
    )

    if shared_domain:
        nonmember_authors = nonmember_authors.filter(email__endswith=shared_domain)
    else:
        for filtered_email in FILTERED_EMAIL_DOMAINS:
            nonmember_authors = nonmember_authors.exclude(email__endswith=filtered_email)

    for filtered_character in FILTERED_CHARACTERS:
        nonmember_authors = nonmember_authors.exclude(email__icontains=filtered_character)

    org_repos = Repository.objects.filter(
        provider="integrations:" + provider,
        organization_id=organization.id,
        integration_id__in=integration_ids,
    ).values_list("id", flat=True)

    recent_commits = Commit.objects.filter(
        repository_id__in=org_repos, date_added__gte=timezone.now() - timedelta(days=30)
    ).values_list("id", flat=True)

    return (
        nonmember_authors.filter(commit__id__in=recent_commits)
        .annotate(Count("commit"))
        .order_by("-commit__count")
    )


def _get_shared_email_domain(organization: Organization) -> str | None:
    # if a member has user_email=None, then they have yet to accept an invite
    org_owners = organization.get_members_with_org_roles(roles=[roles.get_top_dog().id]).exclude(
        Q(user_email=None) | Q(user_email="")
    )

    def _get_email_domain(email: str) -> str | None:
        try:
            domain = Address(addr_spec=email).domain
        except Exception:
            return None

        return domain

    owner_email_domains = {_get_email_domain(owner.user_email) for owner in org_owners}

    # all owners have the same email domain
    if len(owner_email_domains) == 1:
        return owner_email_domains.pop()

    return None


@region_silo_endpoint
class OrganizationMissingMembersEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    owner = ApiOwner.ENTERPRISE

    permission_classes = (MissingMembersPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        # ensure the organization has an integration with the commit feature
        integrations = integration_service.get_integrations(
            organization_id=organization.id, status=ObjectStatus.ACTIVE
        )

        def provider_reducer(dict, integration):
            if not integration.has_feature(feature=IntegrationFeatures.COMMITS):
                return dict
            if dict.get(integration.provider):
                dict[integration.provider].append(integration.id)
            else:
                dict[integration.provider] = [integration.id]

            return dict

        integration_provider_to_ids: Dict[str, Sequence[int]] = reduce(
            provider_reducer, integrations, defaultdict(list)
        )

        shared_domain = _get_shared_email_domain(organization)

        missing_org_members = []

        for integration_provider, integration_ids in integration_provider_to_ids.items():
            # TODO(cathy): allow other integration providers
            if integration_provider != "github":
                continue

            queryset = _get_missing_organization_members(
                organization, integration_provider, integration_ids, shared_domain
            )

            missing_members_for_integration = {
                "integration": integration_provider,
                "users": serialize(
                    list(queryset[:50]), request.user, serializer=MissingOrgMemberSerializer()
                ),
            }

            missing_org_members.append(missing_members_for_integration)

        return Response(
            missing_org_members,
            status=status.HTTP_200_OK,
        )
