from typing import Literal

type ErrorCode = Literal[
    "repository_inactive",
    "repository_not_found",
    "repository_organization_mismatch",
    "rate_limit_exceeded",
    "integration_not_found",
    "unsupported_integration",
    "unknown_provider",
]

ERROR_CODES: dict[ErrorCode, str] = {
    "repository_inactive": "A repository was found but it is inactive.",
    "repository_not_found": "A repository could not be found.",
    "repository_organization_mismatch": "A repository was found but it did not belong to your organization.",
    "rate_limit_exceeded": "Exhausted allocated service-provider quota.",
    "integration_not_found": "An unsupported integration provider was found.",
    "unsupported_integration": "An unsupported integration provider was found.",
    "unknown_provider": "Could not resolve source code management provider.",
}


class SCMError(Exception):
    pass


class SCMCodedError(SCMError):
    def __init__(self, *args, code: ErrorCode, **kwargs) -> None:
        self.code = code
        self.message = ERROR_CODES[code]
        super().__init__(self.code, self.message, *args, **kwargs)


class SCMUnhandledException(SCMError):
    pass


class SCMProviderException(SCMError):
    pass


class SCMProviderNotSupported(SCMError):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class SCMRpcActionCallError(SCMError):
    def __init__(self, action_name: str, error_message: str) -> None:
        self.action_name = action_name
        self.message = f"Error calling method {action_name}: {error_message}"
        super().__init__(self.message)


class SCMRpcActionNotFound(SCMError):
    def __init__(self, action_name: str) -> None:
        self.action_name = action_name
        super().__init__(action_name)


class SCMRpcCouldNotDeserializeRequest(SCMError):
    pass
