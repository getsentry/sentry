from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from email.headerregistry import Address
from functools import reduce
from typing import Dict, Sequence

from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationFeatures
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service

filtered_email_domains = {
    "gmail.com",
    "icloud.com",
    "hotmail.com",
    "outlook.com",
    "noreply.github.com",
    "localhost",
}

filtered_characters = {"+"}


class MissingMembersPermission(OrganizationPermission):
    scope_map = {"GET": ["org:write"]}


def _get_missing_organization_members_query(
    integration_ids: Sequence[int],
    shared_domain: str | None = None,
):
    date = timezone.now() - timedelta(days=30)
    with connection.cursor() as cursor:
        additional_query = ""
        for filtered_character in filtered_characters:
            additional_query += f"""and email not like '%{filtered_character}%' """

        if shared_domain:
            additional_query += f"""and email like '%{shared_domain}' """
        else:
            for filtered_email in filtered_email_domains:
                additional_query += f"""and email not like '%{filtered_email}' """

        query = f"""
                select
                *
                from
                (
                    select
                    email,
                    sentry_commitauthor.external_id,
                    count(*)
                    from
                    sentry_commit
                    join sentry_commitauthor on author_id = sentry_commitauthor.id
                    where
                    repository_id in (
                        select
                        repository_id
                        from
                        sentry_commit
                        join sentry_repository on repository_id = sentry_repository.id
                        where integration_id in ({", ".join(str(id) for id in integration_ids)})
                    )
                    and date_added > '{str(date)}'
                    group by
                    1, 2
                    order by
                    3 desc
                ) a
                where
                external_id is not null {additional_query}
                limit 50
            """

        cursor.execute(query)
        return cursor.fetchall()


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

            integration_missing_members = _get_missing_organization_members_query(
                integration_ids=integration_ids,
                shared_domain=shared_domain,
            )

            serialized_users = [
                {"email": email, "externalId": external_id, "commitCount": commit_count}
                for email, external_id, commit_count in integration_missing_members
            ]

            missing_members_for_integration = {
                "integration": integration_provider,
                "users": serialized_users,
            }

            missing_org_members.append(missing_members_for_integration)

        return Response(
            missing_org_members,
            status=status.HTTP_200_OK,
        )
