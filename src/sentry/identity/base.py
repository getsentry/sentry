from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING, Any

from sentry.identity.services.identity.model import RpcIdentity
from sentry.pipeline.provider import PipelineProvider
from sentry.users.models.identity import Identity

if TYPE_CHECKING:
    from sentry.identity.pipeline import IdentityPipeline  # noqa: F401


class Provider(PipelineProvider["IdentityPipeline"], abc.ABC):
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

    def update_identity(self, new_data, current_data):
        """
        When re-authenticating with a provider, the identity data may need to
        be mutated based on the previous state. An example of this is Google,
        which will not return a `refresh_token` unless the user explicitly
        goes through an approval process.

        Return the new state which should be used for an identity.
        """
        return new_data

    def refresh_identity(self, identity: Identity | RpcIdentity, **kwargs: Any) -> None:
        """
        Updates the AuthIdentity with any changes from upstream. The primary
        example of a change would be signalling this identity is no longer
        valid.

        If the identity is no longer valid an ``IdentityNotValid`` error should
        be raised.
        """
        raise NotImplementedError
