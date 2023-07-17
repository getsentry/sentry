from __future__ import annotations

import logging
from typing import Any, Mapping, Sequence

from sentry_sdk import configure_scope

from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.utils.sdk import (
    bind_ambiguous_org_context,
    bind_organization_context,
    check_tag_for_scope_bleed,
)

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


def get_orgs_from_integration(integration_id: int) -> Sequence[Organization]:
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

    return orgs


def bind_org_context_from_integration(
    integration_id: int, extra: Mapping[str, Any] | None = None
) -> None:
    """
    Given the id of an Integration or an RpcIntegration, get the associated org(s) and bind that
    data to the scope.

    Note: An `Integration` is an instance of given provider's integration, tied to a single entity
    on the provider's end (for example, an instance of the GitHub integration tied to a particular
    GitHub org, or an instance of the Slack integration tied to a particular Slack workspace), which
    can be shared by multiple orgs. Also, it doesn't matter whether the passed id comes from an
    Integration or an RpcIntegration object, because corresponding ones share the same id.
    """

    orgs = get_orgs_from_integration(integration_id)

    if len(orgs) == 0:
        logger.warning(
            f"Can't bind org context - no orgs are associated with integration id={integration_id}.",
            extra=extra,
        )

        # When the `logger.warning` call above was `logger.error`, we saw that the `integration_id`
        # tag on the resulting event didn't match the `integration_id` value logged in the event's
        # message. Even though we've switched to `logger.warning` (and therefore no longer have a
        # sentry event to which to tie the data), we still want to be able track when this happens.
        # (With `add_to_scope=False`, we still log a warning - separate from the one above - on data
        # mismatch.)
        check_tag_for_scope_bleed("integration_id", integration_id, add_to_scope=False)
    elif len(orgs) == 1:
        bind_organization_context(orgs[0])
    else:
        bind_ambiguous_org_context(orgs, f"integration (id={integration_id})")
