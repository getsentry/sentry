from __future__ import absolute_import, print_function

import logging

from .view import ConfigureView


class Provider(object):
    """
    A provider indicates how authenticate should happen for a given service,
    including its configuration and basic identity management.
    """
    name = None

    def __init__(self, key, **config):
        self.key = key
        self.config = config
        self.logger = logging.getLogger('sentry.auth.%s' % (key,))

    def get_configure_view(self):
        return ConfigureView.as_view()

    def get_auth_pipeline(self):
        """
        Return a list of AuthView instances representing the authentication
        pipeline for this provider.
        """
        raise NotImplementedError

    def get_setup_pipeline(self):
        """
        Return a list of AuthView instances representing the initial setup
        pipeline for this provider.

        Defaults to the defined authentication pipeline.
        """
        return self.get_auth_pipeline()

    def build_config(self, state):
        """
        Return a mapping containing provider configuration.

        - ``state`` is the resulting data captured by the pipeline
        """
        raise NotImplementedError

    def build_identity(self, state):
        """
        Return a mapping containing the identity information.

        - ``state`` is the resulting data captured by the pipeline

        >>> {
        >>>     "id": "foo@example.com",
        >>>     "email": "foo@example.com",
        >>>     "name": "Foo Bar",
        >>> }

        The ``email`` and ``id`` keys are required, ``name`` is optional.
        """
        raise NotImplementedError

    def refresh_identity(self, auth_identity):
        """
        Updates the AuthIdentity with any changes from upstream. The primary
        example of a change would be signalling this identity is no longer
        valid.

        If the identity is no longer valid an ``IdentityNotValid`` error should
        be raised.
        """
        raise NotImplementedError
