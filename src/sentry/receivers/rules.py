from typing import Any

from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.models.rule import Rule


def clean_rule_data(data: list[dict[str, Any]]) -> None:
    for datum in data:
        if datum.get("name"):
            del datum["name"]


@receiver(pre_save, sender=Rule, dispatch_uid="pre_save_rule")
def pre_save_rule(instance: Rule, **kwargs: Any) -> None:
    clean_rule_data(instance.data.get("conditions", []))
    clean_rule_data(instance.data.get("actions", []))
