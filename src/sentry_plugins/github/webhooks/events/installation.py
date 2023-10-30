from django.db import IntegrityError, router, transaction

from sentry.models.integrations.integration import Integration

from . import Webhook


class InstallationEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationevent
    def __call__(self, event, organization=None):
        action = event["action"]
        installation = event["installation"]
        # TODO(jess): handle uninstalls
        if action == "created":
            try:
                with transaction.atomic(router.db_for_write(Integration)):
                    Integration.objects.create(
                        provider="github_apps",
                        external_id=installation["id"],
                        name=installation["account"]["login"],
                    )
            except IntegrityError:
                pass
