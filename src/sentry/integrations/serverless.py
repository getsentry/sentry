from __future__ import absolute_import


class ServerlessMixin(object):
    def get_serverless_functions(self):
        """
        Returns a list of serverless functions
        """
        raise NotImplementedError

    def enable_function(self, target):
        raise NotImplementedError
