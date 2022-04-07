from django.db import IntegrityError, transaction

from sentry.models import Integration

from . import Webhook


class InstallationEventWebhook(Webhook):
    # https://developer.github.com/v3/activity/events/types/#installationevent
    def __call__(self, event, organization=None):
        action = event["action"]
        installation = event["installation"]
        # TODO(jess): handle uninstalls
        if action == "created":
            try:
                with transaction.atomic():
                    Integration.objects.create(
                        provider="github_apps",
                        external_id=installation["id"],
                        name=installation["account"]["login"],
                    )
            except IntegrityError:
                pass
