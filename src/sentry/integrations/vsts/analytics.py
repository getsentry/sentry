from __future__ import absolute_import, print_function

from sentry import analytics


class VstsIntegrationNewInstance(analytics.Event):
    type = 'integrations.vsts.new_instance'

    attributes = (
        analytics.Attribute('actor_id'),
        analytics.Attribute('organization_id'),
        analytics.Attribute('instance_name'),
    )


class VstsIntegrationCreateTicket(analytics.Event):
    type = 'integrations.vsts.create_ticket'

    attributes = (
        analytics.Attribute('actor_id'),
        analytics.Attribute('organization_id'),
        analytics.Attribute('issue_id'),
    )


class VstsIntegrationLinkTicket(analytics.Event):
    type = 'integrations.vsts.link_ticket'

    attributes = (
        analytics.Attribute('actor_id'),
        analytics.Attribute('organization_id'),
        analytics.Attribute('issue_id'),
    )


class VstsIntegrationStatusSync(analytics.Event):
    type = 'integrations.vsts.status_sync'

    attributes = (
        analytics.Attribute('old_status'),
        analytics.Attribute('new_status'),
        analytics.Attribute('organization_id'),
        analytics.Attribute('actor_id'),
        analytics.Attribute('issue_id'),
        # Inbound(VSTS->Sentry) or Outbound(Sentry->VSTS)
        analytics.Attribute('direction'),
    )


class VstsIntegrationCommentSync(analytics.Event):
    type = 'integrations.vsts.comment_sync'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('actor_id'),
        analytics.Attribute('issue_id'),

    )


class VstsIntegrationAssigneeSync(analytics.Event):
    type = 'integrations.vsts.assignee_sync'

    attributes = (
        analytics.Attribute('assignee'),  # uhhhh???
        analytics.Attribute('organization_id'),
        analytics.Attribute('actor_id'),
        analytics.Attribute('issue_id'),
        # Inbound(VSTS->Sentry) or Outbound(Sentry->VSTS)
        analytics.Attribute('direction'),
    )


class VstsIntegrationAddRepo(analytics.Event):
    type = 'integrations.vsts.add_repo'

    attributes = (
        analytics.Attribute('repo'),
        analytics.Attribute('organization_id'),
        analytics.Attribute('actor_id'),
    )


class VstsIntegrationResolveViaCommit(analytics.Event):
    type = 'integrations.vsts.resolve_via_commit'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('actor_id'),
        analytics.Attribute('issue_id'),

    )


class VstsIntegrationResolveViaPR(analytics.Event):
    type = 'integrations.vsts.resolve_via_pr'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('actor_id'),
        analytics.Attribute('issue_id')
    )


analytics.register(VstsIntegrationNewInstance)
analytics.register(VstsIntegrationCreateTicket)
analytics.register(VstsIntegrationLinkTicket)
analytics.register(VstsIntegrationStatusSync)
analytics.register(VstsIntegrationAssigneeSync)
analytics.register(VstsIntegrationAddRepo)
analytics.register(VstsIntegrationResolveViaCommit)
analytics.register(VstsIntegrationResolveViaPR)
