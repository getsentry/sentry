from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.models import ApiKey, ApiToken


def enforce_scope_hierarchy(instance, sender, **kwargs):
    print("hit?")
    pass


pre_save.connect(
    enforce_scope_hierarchy,
    sender=ApiKey,
    dispatch_uid="enforce_scope_hierarchy_api_key",
    weak=False,
)

pre_save.connect(
    enforce_scope_hierarchy,
    sender=ApiToken,
    dispatch_uid="enforce_scope_hierarchy_api_token",
    weak=False,
)
