from __future__ import absolute_import

__all__ = ['Integration', 'IntegrationFeatures', 'IntegrationProvider', 'IntegrationMetadata']

import logging
import six
import sys

from collections import namedtuple
from enum import Enum

from sentry.exceptions import InvalidIdentity
from sentry.pipeline import PipelineProvider

from .exceptions import (
    ApiHostError, ApiError, ApiUnauthorized, IntegrationError, UnsupportedResponseType
)
from .constants import ERR_UNAUTHORIZED, ERR_INTERNAL, ERR_UNSUPPORTED_RESPONSE_TYPE
from sentry.models import Identity, OrganizationIntegration

IntegrationMetadata = namedtuple('IntegrationMetadata', [
    'description',  # A markdown description of the integration
    'author',       # The integration author's name
    'noun',         # The noun used to identify the integration
    'issue_url',    # URL where issues should be opened
    'source_url',   # URL to view the source
    'aspects',      # A map of integration specific 'aspects' to the aspect config.
])


class IntegrationFeatures(Enum):
    NOTIFICATION = 'notification'
    ISSUE_BASIC = 'issue_basic'
    ISSUE_SYNC = 'issue_sync'
    COMMITS = 'commits'
    CHAT_UNFURL = 'chat_unfurl'


class IntegrationProvider(PipelineProvider):
    """
    An integration provider describes a third party that can be registered within Sentry.

    The core behavior is simply how to add the integration (the setup
    pipeline), which will likely use a nested pipeline for identity
    authentication, and what kind of configuration is stored.

    This is similar to Sentry's legacy 'plugin' information, except that an
    integration is lives as an instance in the database, and the ``IntegrationProvider``
    class is just a descriptor for how that object functions, and what behavior
    it provides (such as extensions provided).
    """

    # a unique identifier (e.g. 'slack')
    key = None

    # a human readable name (e.g. 'Slack')
    name = None

    # an IntegrationMetadata object, used to provide extra details in the
    # configuration interface of the integration.
    metadata = None

    # an Integration class that will manage the functionality once installed
    integration_cls = None

    # configuration for the setup dialog
    setup_dialog_config = {
        'width': 600,
        'height': 600,
    }

    # whether or not the integration installation be initiated from Sentry
    can_add = True

    # can the integration be enabled specifically for projects?
    can_add_project = False

    # can the integration be disabled ?
    can_disable = False

    # if the integration has no application-style access token, associate
    # the installer's identity to the organization integration
    needs_default_identity = False

    # can be any number of IntegrationFeatures
    features = frozenset()

    @classmethod
    def get_installation(cls, model, organization_id, **kwargs):
        if cls.integration_cls is None:
            raise NotImplementedError

        return cls.integration_cls(model, organization_id, **kwargs)

    def get_logger(self):
        return logging.getLogger('sentry.integration.%s' % (self.key, ))

    def post_install(self, integration, organization):
        pass

    def get_pipeline_views(self):
        """
        Return a list of ``View`` instances describing this integration's
        configuration pipeline.

        >>> def get_pipeline_views(self):
        >>>    return []
        """
        raise NotImplementedError

    def build_integration(self, state):
        """
        Given state captured during the setup pipeline, return a dictionary
        of configuration and metadata to store with this integration.

        This data **must not** be specific to an organization, as the
        integration may be shared among multiple organizations.

        This is the ideal place to store metadata like the 'name' or 'url' to
        the relevant entity, or shared API keys.

        This **must** return an 'external_id' attribute.

        This **should** return a 'name' attribute.

        >>> def build_integration(self, state):
        >>>     return {
        >>>         'external_id': state['id'],
        >>>         'name': state['name'],
        >>>         'metadata': {url': state['url']},
        >>>     }

        This can return the 'expect_exists' flag, and this method  will expect
        that the passed 'external_id' exists and will not attempt to recreate
        or update the integration.

        >>> def build_integration(self, state):
        >>>    return {
        >>>        'external_id': state['id'],
        >>>        'expect_exists': True,
        >>>    }

        """
        raise NotImplementedError

    def setup(self):
        """
        Executed once Sentry has been initialized at runtime.

        >>> def setup(self):
        >>>     bindings.add('repository.provider', GitHubRepositoryProvider, key='github')
        """

    def has_feature(self, feature):
        return feature in self.features


class Integration(object):
    """
    An integration represents an installed integration and manages the
    core functionality of the integration.
    """

    logger = logging.getLogger('sentry.integrations')

    def __init__(self, model, organization_id):
        self.model = model
        self.organization_id = organization_id
        self._org_integration = None

    @property
    def org_integration(self):
        if self._org_integration is None:
            self._org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization_id,
                integration_id=self.model.id,
            )
        return self._org_integration

    def get_organization_config(self):
        """
        Returns a list of JSONForm configuration object descriptors used to
        configure the integration per-organization. This simply represents the
        configuration structure.

        See the JSONForm react component for structure details.
        """
        return []

    def get_config_data(self):
        return self.org_integration.config

    def update_organization_config(self, data):
        """
        Update the configuration field for an organization integration.
        """
        config = self.org_integration.config
        config.update(data)
        self.org_integration.update(config=config)

    def get_project_config(self):
        """
        Provides configuration for the integration on a per-project
        level. See ``get_config_organization``.
        """
        return []

    def get_client(self):
        # Return the api client for a given provider
        raise NotImplementedError

    def get_default_identity(self):
        """
        For Integrations that rely solely on user auth for authentication
        """

        identity = Identity.objects.get(id=self.org_integration.default_auth_id)
        return identity

    def error_message_from_json(self, data):
        return data.get('message', 'unknown error')

    def message_from_error(self, exc):
        if isinstance(exc, ApiUnauthorized):
            return ERR_UNAUTHORIZED
        elif isinstance(exc, ApiHostError):
            return exc.text
        elif isinstance(exc, UnsupportedResponseType):
            return ERR_UNSUPPORTED_RESPONSE_TYPE.format(
                content_type=exc.content_type,
            )
        elif isinstance(exc, ApiError):
            if exc.json:
                msg = self.error_message_from_json(exc.json) or 'unknown error'
            else:
                msg = 'unknown error'
            return (
                'Error Communicating with %s (HTTP %s): %s' % (
                    self.model.get_provider().name,
                    exc.code,
                    msg
                )
            )
        else:
            return ERR_INTERNAL

    def raise_error(self, exc, identity=None):
        if isinstance(exc, ApiUnauthorized):
            six.reraise(
                InvalidIdentity,
                InvalidIdentity(self.message_from_error(exc), identity=identity),
                sys.exc_info()[2]
            )
        elif isinstance(exc, ApiError):
            six.reraise(
                IntegrationError,
                IntegrationError(self.message_from_error(exc)),
                sys.exc_info()[2]
            )
        elif isinstance(exc, IntegrationError):
            raise
        else:
            self.logger.exception(six.text_type(exc))
            six.reraise(
                IntegrationError,
                IntegrationError(self.message_from_error(exc)),
                sys.exc_info()[2]
            )
