from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.models.apikey import ApiKey
from sentry.models.apiscopes import add_scope_hierarchy
from sentry.models.apitoken import ApiToken


@receiver(pre_save, sender=ApiKey, dispatch_uid="enforce_scope_hierarchy_api_key")
@receiver(pre_save, sender=ApiToken, dispatch_uid="enforce_scope_hierarchy_api_token")
def enforce_scope_hierarchy(instance, **kwargs) -> None:
    """
    This pre_save signal enforces scope hierarchy in the ApiToken and ApiKey
    models. It's impossible to know if the scopes have been modified without
    # fetching it from the DB, so we're required to always iterate through them
    to avoid the DB call.

    We use the add_scope_hierarchy helper so we can reuse it in other places
    where this pre_save signal is skipped when updating scopes.
    """
    instance.scope_list = add_scope_hierarchy(instance.scope_list)
