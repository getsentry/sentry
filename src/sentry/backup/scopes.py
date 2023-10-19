from enum import Enum, auto, unique


@unique
class RelocationScope(Enum):
    """Attached to models to specify the scope of import/export operations they are allowed to participate in."""

    # A model that has been purposefully excluded from import/export functionality entirely.
    Excluded = auto()

    # Any `Control`-silo model that is either a `User*` model, or directly owner by one, is in this
    # scope. Models that deal with bestowing administration privileges are excluded, and are
    # included in the `Config` scope instead.
    User = auto()

    # For all models that transitively depend on either `User` or `Organization` root models, and
    # nothing else.
    Organization = auto()

    # Models that deal with configuring or administering an entire Sentry instance. Some of these
    # models transitively rely on `User` models (since their purpose is to mark certain users as
    # administrators and give them elevated, instance-wide privileges), but otherwise these models
    # have no dependencies on other scopes.
    Config = auto()

    # A model that is inextricably tied to a specific Sentry instance. Often, this applies to models
    # that include the instance domain in their data (ex: OAuth or social login tokens related to
    # the specific domain), which therefore are completely non-portable.
    #
    # In practice, this scope is reserved for models that are only useful when backing up or
    # restoring an entire Sentry instance, since there is no reasonable way to use them outside of
    # that specific context.
    Global = auto()


@unique
class ExportScope(Enum):
    """
    When executing the `sentry export` command, these scopes specify which of the above
    `RelocationScope`s should be included in the final export. The basic idea is that each of these
    scopes is inclusive of its predecessor in terms of which `RelocationScope`s it accepts.
    """

    User = {RelocationScope.User}
    Organization = {RelocationScope.User, RelocationScope.Organization}
    Config = {RelocationScope.User, RelocationScope.Config}
    Global = {
        RelocationScope.User,
        RelocationScope.Organization,
        RelocationScope.Config,
        RelocationScope.Global,
    }


@unique
class ImportScope(Enum):
    """
    When executing the `sentry import` command, these scopes specify which of the above
    `RelocationScope`s should be included in the final upload. The basic idea is that each of these
    scopes is inclusive of its predecessor in terms of which `RelocationScope`s it accepts.
    """

    User = {RelocationScope.User}
    Organization = {RelocationScope.User, RelocationScope.Organization}
    Config = {RelocationScope.User, RelocationScope.Config}
    Global = {
        RelocationScope.User,
        RelocationScope.Organization,
        RelocationScope.Config,
        RelocationScope.Global,
    }
