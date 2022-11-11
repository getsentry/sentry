import abc
import logging
from collections import namedtuple
from typing import Any, Mapping, Sequence, cast

from django.utils.encoding import force_text
from django.views import View

from sentry.models import AuthIdentity, Organization, User
from sentry.pipeline import PipelineProvider

from .view import AuthView, ConfigureView


class MigratingIdentityId(namedtuple("MigratingIdentityId", ["id", "legacy_id"])):
    """
    MigratingIdentityId may be used in the ``id`` field of an identity
    dictionary to facilitate migrating user identities from one identifying id
    to another.
    """

    __slots__ = ()

    def __str__(self) -> str:
        return cast(str, force_text(self.id))


class Provider(PipelineProvider, abc.ABC):
    """
    A provider indicates how authenticate should happen for a given service,
    including its configuration and basic identity management.
    """

    # All auth providers by default require the sso-basic feature
    required_feature = "organizations:sso-basic"

    def __init__(self, key: str, **config: Any) -> None:
        super().__init__()
        self._key = key
        self.config = config
        self.logger = logging.getLogger(f"sentry.auth.{self.key}")

    @property
    def key(self) -> str:
        return self._key

    def get_configure_view(self) -> View:
        """
        Return the view which handles configuration (post-setup).
        """
        return ConfigureView.as_view()

    def get_auth_pipeline(self) -> Sequence[AuthView]:
        """
        Return a list of AuthView instances representing the authentication
        pipeline for this provider.
        """
        raise NotImplementedError

    def get_setup_pipeline(self) -> Sequence[AuthView]:
        """
        Return a list of AuthView instances representing the initial setup
        pipeline for this provider.

        Defaults to the defined authentication pipeline.
        """
        return self.get_auth_pipeline()

    def get_pipeline_views(self) -> Sequence[AuthView]:
        return self.get_auth_pipeline()

    # TODO: state should be Mapping[str, Any]?
    # Must be reconciled with sentry.pipeline.base.Pipeline.fetch_state
    def build_config(self, state: Any) -> Mapping[str, Any]:
        """
        Return a mapping containing provider configuration.

        - ``state`` is the resulting data captured by the pipeline
        """
        raise NotImplementedError

    def build_identity(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
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

    def update_identity(
        self, new_data: Mapping[str, Any], current_data: Mapping[str, Any]
    ) -> Mapping[str, Any]:
        """
        When re-authenticating with a provider, the identity data may need to
        be mutated based on the previous state. An example of this is Google,
        which will not return a `refresh_token` unless the user explicitly
        goes through an approval process.

        Return the new state which should be used for an identity.
        """
        return new_data

    def refresh_identity(self, auth_identity: AuthIdentity) -> None:
        """
        Updates the AuthIdentity with any changes from upstream. The primary
        example of a change would be signalling this identity is no longer
        valid.

        If the identity is no longer valid an ``IdentityNotValid`` error should
        be raised.
        """
        raise NotImplementedError

    def can_use_scim(self, organization: Organization, user: User) -> bool:
        """
        Controls whether or not a provider can have SCIM enabled to manage users.
        By default we have this on for all providers.
        """
        return True
