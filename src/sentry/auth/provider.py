from __future__ import absolute_import, print_function

import logging


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

    def get_config_form(self, request):
        # return FormClass(request.POST or None)
        raise NotImplementedError

    def get_auth_pipeline(self):
        """
        Return a list of AuthView instances representing the authentication
        pipeline for this provider.
        """
        raise NotImplementedError

    def get_identity(self, state):
        raise NotImplementedError
