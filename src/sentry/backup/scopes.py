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

    # For all models that transitively depend on either `User` or `Organization` root models, and
    # nothing else.
    Organization = auto()

    # Any `Control`-silo model that is either a `User*` model, or directly owner by one, is in this
    # scope.
    User = auto()


@unique
class ExportScope(Enum):
    """
    When executing the `sentry export` command, these scopes specify which of the above
    `RelocationScope`s should be included in the final export. The basic idea is that each of these
    scopes is inclusive of its predecessor in terms of which `RelocationScope`s it accepts.
    """

    User = {RelocationScope.User}
    Organization = {RelocationScope.User, RelocationScope.Organization}
    Global = {RelocationScope.User, RelocationScope.Organization, RelocationScope.Global}


@unique
class ImportScope(Enum):
    """
    When executing the `sentry import` command, these scopes specify which of the above
    `RelocationScope`s should be included in the final upload. The basic idea is that each of these
    scopes is inclusive of its predecessor in terms of which `RelocationScope`s it accepts.
    """

    User = {RelocationScope.User}
    Organization = {RelocationScope.User, RelocationScope.Organization}
    Global = {RelocationScope.User, RelocationScope.Organization, RelocationScope.Global}
