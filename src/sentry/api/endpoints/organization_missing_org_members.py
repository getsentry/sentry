from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from email.headerregistry import Address
from functools import reduce
from typing import TYPE_CHECKING, Dict, Sequence

from django.db.models import Q, QuerySet
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
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
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
    org_id = organization.id
    domain_query = ""
    if shared_domain:
        domain_query = f"AND sentry_commitauthor.email::text LIKE '%%{shared_domain}'"
    else:
        for filtered_email_domain in FILTERED_EMAIL_DOMAINS:
            domain_query += (
                f"AND sentry_commitauthor.email::text NOT LIKE '%%{filtered_email_domain}' "
            )

    date_added = (timezone.now() - timedelta(days=30)).strftime("%Y-%m-%d, %H:%M:%S")

    query = f"""
        SELECT sentry_commitauthor.id, sentry_commitauthor.organization_id, sentry_commitauthor.name, sentry_commitauthor.email, sentry_commitauthor.external_id, COUNT(sentry_commit.id) AS commit__count FROM sentry_commitauthor
        INNER JOIN (
            select * from sentry_commit
            WHERE sentry_commit.organization_id = {org_id}
            AND date_added >= '{date_added}'
            order by date_added desc limit 1000
        ) as sentry_commit ON sentry_commitauthor.id = sentry_commit.author_id

        WHERE sentry_commit.repository_id IN
        (
            select id
            from sentry_repository
            where provider = 'integrations:{provider}'
            and organization_id = {org_id}
            and integration_id in ({", ".join([str(id) for id in integration_ids])})
            )
        AND sentry_commit.author_id IN
            (select id from sentry_commitauthor
                WHERE sentry_commitauthor.organization_id = {org_id}
                AND NOT (
                    (sentry_commitauthor.email IN (select concat(email, user_email) from sentry_organizationmember where organization_id = {org_id} and (email is not null or user_email is not null)
                )
        OR sentry_commitauthor.external_id IS NULL))
        {domain_query}
        AND NOT (UPPER(sentry_commitauthor.email::text) LIKE UPPER('%%+%%'))
        )

        GROUP BY sentry_commitauthor.id ORDER BY commit__count DESC limit 50
    """.format(
        org_id, date_added, provider, integration_ids, domain_query
    )

    return list(CommitAuthor.objects.raw(query))


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
                "users": serialize(queryset, request.user, serializer=MissingOrgMemberSerializer()),
            }

            missing_org_members.append(missing_members_for_integration)

        return Response(
            missing_org_members,
            status=status.HTTP_200_OK,
        )
