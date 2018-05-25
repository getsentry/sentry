from __future__ import absolute_import


class RepositoryMixin(object):

    def get_config(self, organization):
        raise NotImplementedError

    def validate_config(self, organization, config):
        return config

    def create_repository(self, organization, data):
        raise NotImplementedError

    def delete_repository(self, repo):
        pass

    def compare_commits(self, repo, start_sha, end_sha):
        raise NotImplementedError

    def handle_api_error(self, error):
        raise NotImplementedError  # TODO(LB): Figure out if this is needed
