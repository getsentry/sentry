from enum import Enum


class ApiPublishStatus(Enum):
    """
    Used to track if an API is publicly documented
    """

    # A promotion ladder, least to most committed. Only the members for which
    # `is_published` is true reach the OpenAPI spec; see sentry/apidocs/hooks.py.
    PRIVATE = "private"  # not published, and not intended to be
    EXPERIMENTAL = "experimental"  # not published; PUBLIC is intended, but nothing enforces that
    PUBLIC_EXPERIMENTAL = "public_experimental"  # published, but may still change incompatibly
    PUBLIC = "public"  # published; its attributes and their types are a stability commitment

    @property
    def is_published(self) -> bool:
        """Whether methods with this status are emitted into the public OpenAPI spec.

        Publication and stability are separate promises. Everything published is held
        to the same documentation bar -- descriptions, a tag, a unique summary, a
        declared response shape -- whether or not it also promises not to change.
        """
        return self in (ApiPublishStatus.PUBLIC, ApiPublishStatus.PUBLIC_EXPERIMENTAL)
