from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken


@receiver(pre_save, sender=ApiKey, dispatch_uid="enforce_scope_hierarchy_api_key")
@receiver(pre_save, sender=ApiToken, dispatch_uid="enforce_scope_hierarchy_api_token")
def enforce_scope_hierarchy(instance, **kwargs) -> None:
    # It's impossible to know if the token scopes have been modified without
    # fetching it from the DB, so we always enforce scope hierarchy
    new_scopes = set(instance.get_scopes())
    for scope in instance.scope_list:
        if scope in SENTRY_SCOPES:
            new_scopes = new_scopes.union(SENTRY_SCOPE_HIERARCHY_MAPPING[scope])
    instance.scope_list = sorted(new_scopes)
