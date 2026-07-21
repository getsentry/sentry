import enum

# Legacy Seer agent capability-token prefix. New tokens are raw JWTs identified by their
# protected ``typ`` header; keep accepting this prefix for already-issued five-minute tokens.
SENTRY_AGENT_TOKEN_PREFIX = "sntryag_"


class AuthTokenType(enum.StrEnum):
    """
    Represents the various API/auth token types in the Sentry code base.
    The values equate to the expected prefix of each of the token types.
    """

    USER = "sntryu_"
    ORG = "sntrys_"
    USER_APP = "sntrya_"
    INTEGRATION = "sntryi_"

    # tokens created prior to our prefixing
    __empty__: None = None

    @classmethod
    def choices(cls) -> list[tuple[None, None] | tuple[str, str]]:
        return [(None, None), *((e.value, e.name.replace("_", " ").title()) for e in cls)]
