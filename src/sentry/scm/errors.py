from scm.errors import SCMError


class SCMProviderEventNotSupported(SCMError):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class SCMProviderNotSupported(SCMError):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class SCMCapabilityUnsupported(SCMError):
    """Raised when a SourceCodeManager instance does not implement the protocol the caller needs."""

    def __init__(self, capability: str, provider_name: str | None = None) -> None:
        self.capability = capability
        self.provider_name = provider_name
        super().__init__(
            f"SCM capability {capability!r} not supported by provider {provider_name!r}"
        )
