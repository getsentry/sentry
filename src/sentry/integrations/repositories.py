from __future__ import absolute_import


class RepositoryMixin(object):

    def get_repositories(self):
        """
        Get a list of availble repositories for an installation

        >>> def get_repositories(self):
        >>>     return self.get_client().get_repositories()
        """
        raise NotImplementedError
