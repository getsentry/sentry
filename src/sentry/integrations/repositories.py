from __future__ import absolute_import

from sentry.constants import ObjectStatus
from sentry.models import Repository


class RepositoryMixin(object):

    def get_repositories(self):
        """
        Get a list of availble repositories for an installation

        >>> def get_repositories(self):
        >>>     return self.get_client().get_repositories()

        return {
            'name': display_name,
            'identifier': external_repo_id,
        }
        """
        raise NotImplementedError

    def reinstall_repositories(self):
        """
        reinstalls repositories associated with the integration
        """
        organizations = self.model.organizations.all()
        Repository.objects.filter(
            organization_id__in=organizations.values_list('id', flat=True),
            provider='integrations:%s' % self.model.provider,
            integration_id=self.model.id,
        ).update(status=ObjectStatus.VISIBLE)
