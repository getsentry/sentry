class Webhook:
    def __call__(self, event, organization=None):
        raise NotImplementedError


def is_anonymous_email(email):
    return email[-25:] == "@users.noreply.github.com"


def get_external_id(username):
    return "github:%s" % username


from .installation import InstallationEventWebhook
from .installation_repository import InstallationRepositoryEventWebhook
from .pull_request import PullRequestEventWebhook
from .push import PushEventWebhook

__all__ = (
    "InstallationEventWebhook",
    "InstallationRepositoryEventWebhook",
    "PullRequestEventWebhook",
    "PushEventWebhook",
    "is_anonymous_email",
    "get_external_id",
    "Webhook",
)
