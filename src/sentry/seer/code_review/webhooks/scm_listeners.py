from typing import cast

from scm.types import CreatePullRequestReactionProtocol, ProviderName

from sentry.integrations.models import Integration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import PullRequestEvent


@scm_event_stream.listen_for_pull_request
def handle_pull_request_via_scm_stream(e: PullRequestEvent) -> None:
    # @todo(When we remove the old handlers for GitHub) Remove this check, and process GitHub webhooks
    if e.subscription_event["type"] != "gitlab":
        return

    # Do a milion checks to decide wether to process this event

    # @todo(NOW) Implement the milion checks, like in ./handlers.py and ./pull_request.py

    if e.action not in ["opened", "reopened"]:
        return

    # Process the event

    if e.subscription_event["type"] == "gitlab":
        sentry_meta = e.subscription_event["sentry_meta"]
        assert sentry_meta is not None
        assert len(sentry_meta) == 1
        organization_id = sentry_meta[0]["organization_id"]
        assert organization_id is not None
        organization = Organization.objects.get(id=organization_id)
        integration_id = sentry_meta[0]["integration_id"]
        assert integration_id is not None
        integration = Integration.objects.get(id=integration_id)
        provider = cast(ProviderName, integration.provider)
        assert provider == "gitlab"
        gitlab_host_name = integration.metadata["domain_name"]
        repository = Repository.objects.get(
            organization_id=organization_id,
            provider=f"integrations:{provider}",
            external_id=f"{gitlab_host_name}:{e.pull_request['repo_id']}",
        )
    else:
        assert False

    scm = make_scm(organization_id, repository.id, referrer="seer")
    if isinstance(scm, CreatePullRequestReactionProtocol):
        scm.create_pull_request_reaction(
            pull_request_id=e.pull_request["id"],
            reaction="eyes",
        )

    # Forward the event to Seer

    target_commit_sha = e.pull_request["head"]["sha"]
    if not isinstance(target_commit_sha, str) or not target_commit_sha:
        return

    tags = {
        "scm_provider": e.subscription_event["type"],
        "sentry_integration_id": str(integration_id),
        "sentry_organization_id": str(organization_id),
        "sentry_organization_slug": organization.slug,
        "scm_event_action": e.action,
    }

    from .task import schedule_scm_task

    schedule_scm_task(
        pull_request_event=e,
        organization=organization,
        repo=repository,
        target_commit_sha=target_commit_sha,
        tags=tags,
    )
