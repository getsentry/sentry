from __future__ import annotations

from typing import Optional, Tuple

from sentry.backup.dependencies import ImportKind, dependencies, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope


class OverwritableConfigMixin:
    """
    Handles the `ImportFlags.overwrite_configs` setting when it's piped through to a
    `RelocationScope.Config` model with at least one `unique=True` field, thereby handling the
    collision in the manner the importer requested.
    """

    # TODO(getsentry/team-ospo#190): Clean up the type checking in this method.
    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # Get all unique sets that will potentially cause collisions.
        uniq_sets = dependencies()[get_model_name(self)].get_uniques_without_foreign_keys()  # type: ignore

        # Don't use this mixin for models with multiple unique sets; write custom logic instead.
        assert len(uniq_sets) <= 1

        # Must set `__relocation_custom_ordinal__` on models that use this mixin.
        assert getattr(self.__class__, "__relocation_custom_ordinal__", None) is not None

        if self.get_relocation_scope() == RelocationScope.Config:  # type: ignore
            if len(uniq_sets) == 1:
                uniq_set = uniq_sets[0]
                query = dict()
                for uniq_field_name in uniq_set:
                    if getattr(self, uniq_field_name, None) is not None:
                        query[uniq_field_name] = getattr(self, uniq_field_name)

                # If all of the fields in the unique set are NULL, we'll avoid a collision, so exit
                # early and write a new entry.
                if len(query) > 0:
                    existing = self.__class__.objects.filter(**query).first()  # type: ignore
                    if existing:
                        # Re-use the existing data if config overwrite is disabled.
                        if not flags.overwrite_configs:
                            return (existing.pk, ImportKind.Existing)

                        # We are performing an overwrite (ie, keeping the old pk, but using all of
                        # the imported values).
                        self.pk = existing.pk
                        self.save()  # type: ignore
                        return (self.pk, ImportKind.Overwrite)

        # Does not have a single colliding unique field - write as usual.
        return super().write_relocation_import(scope, flags)  # type: ignore
