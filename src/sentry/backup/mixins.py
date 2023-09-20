from __future__ import annotations

from typing import Optional, Tuple

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope


class OverwritableConfigMixin:
    """
    Handles the `ImportFlags.overwrite_configs` setting when it's piped through to a `RelocationScope.Config` model with at least one `unique=True` field, thereby handling the collision in the manner the importer requested.
    """

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # TODO(getsentry/team-ospo#190): Clean up the type checking here.
        if self.get_relocation_scope() == RelocationScope.Config:  # type: ignore
            # Get all fields with `unique=True` for this model.
            cls = self.__class__
            uniq_fields = [
                f.name
                for f in cls._meta.get_fields()  # type: ignore
                if getattr(f, "unique", False) and f.name != "id"
            ]

            # Don't use this mixin for models with multiple `unique=True` fields; write custom logic
            # instead.
            if len(uniq_fields) > 1:
                raise ValueError(
                    "Cannot use `OverwritableConfigMixin` on model with multiple unique fields"
                )
            if len(uniq_fields) == 1 and getattr(self, uniq_fields[0], None) is not None:
                query = dict()
                query[uniq_fields[0]] = getattr(self, uniq_fields[0])
                existing = self.__class__.objects.filter(**query).first()  # type: ignore
                if existing:
                    # Re-use the existing data if config overwrite is disabled.
                    if not flags.overwrite_configs:
                        return (existing.pk, ImportKind.Existing)

                    # We are performing an overwrite (ie, keeping the old pk, but using all of the
                    # imported values).
                    self.pk = existing.pk
                    self.save()  # type: ignore
                    return (self.pk, ImportKind.Overwrite)

        # Does not have a single colliding unique field - write as usual.
        return super().write_relocation_import(scope, flags)  # type: ignore
