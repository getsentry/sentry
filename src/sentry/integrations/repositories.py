from __future__ import absolute_import

from sentry.constants import ObjectStatus
from sentry.models import Repository


class RepositoryMixin(object):
    # whether or not integration has the ability to search through Repositories
    # dynamically given a search query
    repo_search = False

    def get_repositories(self, query=None):
        """
        Get a list of available repositories for an installation

        >>> def get_repositories(self):
        >>>     return self.get_client().get_repositories()

        return [{
            'name': display_name,
            'identifier': external_repo_id,
        }]

        The shape of the `identifier` should match the data
        returned by the integration's
        IntegrationRepositoryProvider.repository_external_slug()
        """
        raise NotImplementedError

    def get_unmigratable_repositories(self):
        return []

    def reinstall_repositories(self):
        """
        reinstalls repositories associated with the integration
        """
        organizations = self.model.organizations.all()
        Repository.objects.filter(
            organization_id__in=organizations.values_list("id", flat=True),
            provider="integrations:%s" % self.model.provider,
            integration_id=self.model.id,
        ).update(status=ObjectStatus.VISIBLE)

    def has_repo_access(self, repo):
        raise NotImplementedError
