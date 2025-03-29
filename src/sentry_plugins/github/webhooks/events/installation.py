from django.db import IntegrityError, router, transaction

from sentry.integrations.models.integration import Integration
from sentry.utils.rollback_metrics import incr_rollback_metrics

from . import Webhook


class InstallationEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationevent
    def __call__(self, event, organization):
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
                incr_rollback_metrics(Integration)
                pass
