class SCMError(Exception):
    pass


class SCMProviderException(SCMError):
    pass


class SCMCodedError(SCMError):
    pass


class SCMUnhandledException(SCMError):
    pass
