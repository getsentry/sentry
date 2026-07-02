from scm.errors import SCMError


class SCMProviderEventNotSupported(SCMError):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class SCMProviderNotSupported(SCMError):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)
