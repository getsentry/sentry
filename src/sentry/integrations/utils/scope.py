from __future__ import annotations

import logging
from typing import cast

from sentry_sdk import configure_scope

from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.sdk import bind_ambiguous_org_context, bind_organization_context

logger = logging.getLogger(__name__)


def clear_tags_and_context() -> None:
    """Clear certain tags and context since it should not be set."""
    reset_values = False
    with configure_scope() as scope:
        for tag in ["organization", "organization.slug"]:
            if tag in scope._tags:
                reset_values = True
                del scope._tags[tag]

        if "organization" in scope._contexts:
            reset_values = True
            del scope._contexts["organization"]

        if reset_values:
            logger.info("We've reset the context and tags.")


def get_orgs_from_integration(integration_id: int) -> list[Organization]:
    """
    Given the id of an `Integration`, return a list of associated `Organization` objects.

    Note: An `Integration` is an instance of given provider's integration, tied to a single entity
    on the provider's end (for example, an instance of the GitHub integration tied to a particular
    GitHub org, or an instance of the Slack integration tied to a particular Slack workspace), which
    can be shared by multiple orgs.
    """

    _, org_integrations = integration_service.get_organization_contexts(
        integration_id=integration_id
    )
    orgs = Organization.objects.get_many_from_cache(
        [org_integration.organization_id for org_integration in org_integrations]
    )

    return cast("list[Organization]", orgs)


def bind_org_context_from_integration(integration_id: int) -> None:
    """
    Given the id of an Integration, get the associated org(s) and bind that data to the scope.

    Note: An `Integration` is an instance of given provider's integration, tied to a single entity
    on the provider's end (for example, an instance of the GitHub integration tied to a particular
    GitHub org, or an instance of the Slack integration tied to a particular Slack workspace), which
    can be shared by multiple orgs.
    """

    orgs = get_orgs_from_integration(integration_id)

    if len(orgs) == 0:
        raise IntegrationError(f"No orgs are associated with integration id={integration_id}")
    elif len(orgs) == 1:
        bind_organization_context(orgs[0])
    else:
        bind_ambiguous_org_context(orgs, f"integration (id={integration_id})")
