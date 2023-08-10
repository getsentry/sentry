from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING
from sentry.models import ApiKey, ApiToken


@receiver(pre_save, sender=ApiKey, dispatch_uid="enforce_scope_hierarchy_api_key")
@receiver(pre_save, sender=ApiToken, dispatch_uid="enforce_scope_hierarchy_api_token")
def enforce_scope_hierarchy(instance, **kwargs) -> None:
    # It's impossible to know if the token scopes have been modified without
    # fetching it from the DB, so we always enforce scope hierarchy
    old_scopes = set(instance.get_scopes())
    new_scopes = old_scopes.copy()
    for scope in old_scopes:
        new_scopes = new_scopes.union(SENTRY_SCOPE_HIERARCHY_MAPPING[scope])
    instance.scope_list = list(new_scopes)
