import abc
import logging

from sentry.pipeline import PipelineProvider


class Provider(PipelineProvider, abc.ABC):
    """
    A provider indicates how identity authenticate should happen for a given service.
    """

    def __init__(self, **config):
        super().__init__()
        self.config = config
        self.logger = logging.getLogger(f"sentry.identity.{self.key}")

    def build_identity(self, state):
        """
        Return a mapping containing the identity information.

        - ``state`` is the resulting data captured by the pipeline

        >>> {
        >>>     "id":     "foo@example.com",
        >>>     "email":  "foo@example.com",
        >>>     "name":   "Foo Bar",
        >>>     "scopes": ['email', ...],
        >>>     "data":   { ... },
        >>> }

        The ``id`` key is required.

        The ``id`` may be passed in as a ``MigratingIdentityId`` should the
        the id key be migrating from one value to another and have multiple
        lookup values.

        If the identity can not be constructed an ``IdentityNotValid`` error
        should be raised.
        """
        raise NotImplementedError

    def refresh_identity(self, auth_identity, *args, **kwargs):
        """
        Updates the AuthIdentity with any changes from upstream. The primary
        example of a change would be signalling this identity is no longer
        valid.

        If the identity is no longer valid an ``IdentityNotValid`` error should
        be raised.
        """
        raise NotImplementedError
