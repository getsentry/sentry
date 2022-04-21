from sentry.models import Integration, Repository

from . import Webhook


class InstallationRepositoryEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationrepositoriesevent
    def __call__(self, event, organization=None):
        installation = event["installation"]

        integration = Integration.objects.get(
            external_id=installation["id"], provider="github_apps"
        )

        repos_added = event["repositories_added"]

        if repos_added:
            for org_id in integration.organizations.values_list("id", flat=True):
                for r in repos_added:
                    config = {"name": r["full_name"]}
                    repo, created = Repository.objects.get_or_create(
                        organization_id=org_id,
                        name=r["full_name"],
                        provider="github",
                        external_id=r["id"],
                        defaults={
                            "url": "https://github.com/{}".format(r["full_name"]),
                            "config": config,
                            "integration_id": integration.id,
                        },
                    )
                    if not created:
                        repo.config.update(config)
                        repo.integration_id = integration.id
                        repo.save()
        # TODO(jess): what do we want to do when they're removed?
        # maybe signify that we've lost access but not deleted?
