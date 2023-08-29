from enum import Enum, auto, unique


@unique
class RelocationScope(Enum):
    """Attached to models to specify the scope of import/export operations they are allowed to participate in."""

    # A model that has been purposefully excluded from import/export functionality entirely.
    Excluded = auto()

    # A model related to some global feature of Sentry. `Global` models are best understood via
    # exclusion: they are all of the exportable `Control`-silo models that are **not** somehow tied
    # to a specific user.
    Global = auto()

    # Any `Control`-silo model that is either a `User*` model, or directly owner by one, is in this
    # scope.
    User = auto()

    # For all `Region`-siloed models tied to a specific `Organization`.
    Organization = auto()
