from __future__ import absolute_import, print_function

import logging


class Provider(object):
    """
    A provider indicates how authenticate should happen for a given service,
    including its configuration and basic identity management.
    """
    def __init__(self, key, **config):
        self.key = key
        self.config = config
        self.logger = logging.getLogger('sentry.auth.%s' % (key,))

    def get_config_form(self, request):
        # return FormClass(request.POST or None)
        raise NotImplementedError

    def get_auth_pipeline(self):
        # NOTE: we want to generate a unique url per step, this can be resolved
        # by doing something like md5('view.Path').hexdigest(). Our only goal
        # is to make it unique and ensure permanence
        raise NotImplementedError

    def get_identity(self, state):
        raise NotImplementedError
