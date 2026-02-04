from typing import Literal

type ErrorCode = Literal[
    "repository_inactive",
    "repository_not_found",
    "repository_organization_mismatch",
    "rate_limit_exceeded",
    "integration_not_found",
]

ERROR_CODES: dict[ErrorCode, str] = {
    "repository_inactive": "A repository was found but it is inactive.",
    "repository_not_found": "A repository could not be found.",
    "repository_organization_mismatch": "A repository was found but it did not belong to your organization.",
    "rate_limit_exceeded": "Exhausted allocated service-provider quota.",
    "integration_not_found": "An unsupported integration provider was found.",
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
