from __future__ import absolute_import, print_function

import logging
from collections import namedtuple

from django.utils.encoding import force_text, python_2_unicode_compatible


from .view import ConfigureView


@python_2_unicode_compatible
class MigratingIdentityId(namedtuple("MigratingIdentityId", ["id", "legacy_id"])):
    """
    MigratingIdentityId may be used in the ``id`` field of an identity
    dictionary to facilitate migrating user identities from one identifying id
    to another.
    """

    __slots__ = ()

    def __str__(self):
        return force_text(self.id)


class Provider(object):
    """
    A provider indicates how authenticate should happen for a given service,
    including its configuration and basic identity management.
    """

    name = None

    # All auth providers by default require the sso-basic feature
    required_feature = "organizations:sso-basic"

    def __init__(self, key, **config):
        self.key = key
        self.config = config
        self.logger = logging.getLogger("sentry.auth.%s" % (key,))

    def get_configure_view(self):
        """
        Return the view which handles configuration (post-setup).
        """
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
        >>>     "email_verified": True,
        >>> }

        The ``email`` and ``id`` keys are required, ``name`` is optional.

        The ``id`` may be passed in as a ``MigratingIdentityId`` should the
        the id key be migrating from one value to another and have multiple
        lookup values.

        The provider is trustable and the email address is verified by the provider,
        the ``email_verified`` attribute should be set to ``True``.

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

    def refresh_identity(self, auth_identity):
        """
        Updates the AuthIdentity with any changes from upstream. The primary
        example of a change would be signalling this identity is no longer
        valid.

        If the identity is no longer valid an ``IdentityNotValid`` error should
        be raised.
        """
        raise NotImplementedError
