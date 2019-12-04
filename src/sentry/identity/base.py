from __future__ import absolute_import, print_function

import logging

from sentry.pipeline import PipelineProvider


class Provider(PipelineProvider):
    """
    A provider indicates how identity authenticate should happen for a given service.
    """

    # The unique identifier of the provider
    key = None

    # A human readable name for this provider
    name = None

    def __init__(self, **config):
        self.config = config
        self.logger = logging.getLogger(u"sentry.identity.%s".format(self.key))

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

    def update_identity(self, new_data, current_data):
        """
        When re-authenticating with a provider, the identity data may need to
        be mutated based on the previous state. An example of this is Google,
        which will not return a `refresh_token` unless the user explicitly
        goes through an approval process.

        Return the new state which should be used for an identity.
        """
        return new_data

    def refresh_identity(self, auth_identity, *args, **kwargs):
        """
        Updates the AuthIdentity with any changes from upstream. The primary
        example of a change would be signalling this identity is no longer
        valid.

        If the identity is no longer valid an ``IdentityNotValid`` error should
        be raised.
        """
        raise NotImplementedError
