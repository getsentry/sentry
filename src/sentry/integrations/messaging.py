from abc import ABC, abstractmethod
from dataclasses import dataclass

from django.urls import re_path
from django.urls.resolvers import URLPattern
from django.views.generic import View

from sentry import analytics
from sentry.integrations.base import IntegrationProvider
from sentry.rules import rules
from sentry.rules.actions import IntegrationEventAction


@dataclass(frozen=True)
class MessagingIdentityLinkViewSet:
    """An integration's set of view classes for linking and unlinking identities."""

    link_personal_identity: type[View]
    unlink_personal_identity: type[View]

    # TODO: Allow these to be optional? Require for all messaging integrations?
    link_team_identity: type[View] | None = None
    unlink_team_identity: type[View] | None = None


class MessagingIntegrationSpec(ABC):
    """Represent the feature set for a messaging integration.

    This class is intended to serve as a top-level "table of contents" for all the
    code that supports integration of a third-party service with Sentry. The
    IntegrationProvider class, which this class incorporates, provides specifications
    for the base integration. This class's distinct purpose is to adds whatever
    features and business logic are particular to messaging integrations.

    This class is currently under development and does not yet represent the complete
    feature set for messaging integrations. We should continue developing it by
    adding anything that is required for all messaging integrations or common across
    many of them, especially where there code or patterns are duplicated.
    """

    def initialize(self) -> None:
        """Initialize a messaging integration.

        We expect each MessagingIntegrationSpec implementation (i.e., concrete
        subclass) to be instantiated once and to have this method called in an
        `__init__` module, or somewhere else that is reliably evaluated on start-up.

        See docstrings on `integration_provider` and
        `get_identity_view_set_url_patterns` for things *not* covered by this method,
        which require additional boilerplate.
        """

        if self.notify_service_action:
            rules.add(self.notify_service_action)
        if self.notification_sent:
            analytics.register(self.notification_sent)

    @abstractmethod
    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        """Define the class of the integration provider.

        This class is the top-level description of a third-party service that can be
        integrated with a Sentry instance. It provides the key used by the persistent
        Integration model and the corresponding IntegrationInstallation class.

        TODO: Replace code in `register_plugins` (sentry/runner/initializer.py) that
              receives and invokes IntegrationProvider classes, which currently
              receives them via the SENTRY_DEFAULT_INTEGRATIONS server conf value.
        """
        raise NotImplementedError

    @abstractmethod
    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        """Define the view classes for linking and unlinking identities."""
        raise NotImplementedError

    def get_identity_view_set_url_patterns(self) -> list[URLPattern]:
        """Build URL patterns for supported identity-linking views.

        The returned pattern objects can be added to a `urlpatterns` Django value in
        the appropriate place.

        TODO: Fold into `initialize` somehow? Not ideal that we require some extra
              boilerplate in a `urls` module (djust Django things).
        """

        def _build_path(op_slug: str, view_cls: type[View] | None) -> URLPattern | None:
            if view_cls is None:
                return None
            integration_key = self.integration_provider.key
            return re_path(
                route=rf"^{op_slug}/(?P<signed_params>[^\/]+)/$",
                view=view_cls.as_view(),
                name=f"sentry-integration-{integration_key}-{op_slug}",
            )

        vs = self.identity_view_set
        paths = [
            _build_path("link-identity", vs.link_personal_identity),
            _build_path("unlink-identity", vs.unlink_personal_identity),
            _build_path("link-team", vs.link_team_identity),
            _build_path("unlink-team", vs.unlink_team_identity),
        ]
        return [path for path in paths if path is not None]

    @abstractmethod
    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        """Define the event action to be added to the global RuleRegistry."""
        raise NotImplementedError

    @abstractmethod
    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        """Define an analytics event for a notification being sent.

        Development note: This one was singled out purely because MsTeams does it.
        See `sentry/integrations/slack/analytics.py` for a lot of other events that
        we might want to make universal to all messaging integrations. Once we have a
        common set of analytics events, it probably is best to represent them as a
        compound object (similar to `identity_view_set`) rather than as a bunch of
        class-level properties.
        """
        raise NotImplementedError

    # Requirements for messaging feature per tech spec

    @property
    def help_view(self) -> type[View] | None:
        """TODO?"""
        return None

    @property
    def support(self) -> type[View] | None:
        """TODO?"""
        return None

    @property
    def documentation(self) -> type[View] | None:
        """TODO?"""
        return None
