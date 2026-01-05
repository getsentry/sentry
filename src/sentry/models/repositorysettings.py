from __future__ import annotations

from enum import StrEnum
from typing import Any

from django.contrib.postgres.fields.array import ArrayField
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr


class CodeReviewTrigger(StrEnum):
    ON_COMMAND_PHRASE = "on_command_phrase"
    ON_NEW_COMMIT = "on_new_commit"
    ON_READY_FOR_REVIEW = "on_ready_for_review"

    @classmethod
    def as_choices(cls) -> tuple[tuple[str, str], ...]:
        return tuple((trigger.value, trigger.value) for trigger in cls)


@region_silo_model
class RepositorySettings(Model):
    """
    Stores (organization) repository specific settings.
    """

    __relocation_scope__ = RelocationScope.Global

    repository = FlexibleForeignKey(
        "sentry.Repository", on_delete=models.CASCADE, unique=True, db_index=True
    )
    enabled_code_review = models.BooleanField(default=False)
    code_review_triggers = ArrayField(
        models.CharField(max_length=32, choices=CodeReviewTrigger.as_choices()),
        default=lambda: [CodeReviewTrigger.ON_COMMAND_PHRASE.value],
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_repositorysettings"

    __repr__ = sane_repr("repository_id", "enabled_code_review")

    def save(self, *args: Any, **kwargs: Any) -> None:
        # Ensure ON_COMMAND_PHRASE is always a trigger
        if self.code_review_triggers is None:
            self.code_review_triggers = [CodeReviewTrigger.ON_COMMAND_PHRASE.value]
        else:
            triggers = list(self.code_review_triggers)
            if CodeReviewTrigger.ON_COMMAND_PHRASE.value not in triggers:
                triggers.append(CodeReviewTrigger.ON_COMMAND_PHRASE.value)
                self.code_review_triggers = triggers

        super().save(*args, **kwargs)
