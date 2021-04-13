import logging

from django.db import IntegrityError
from sentry_sdk import configure_scope

from sentry.constants import ObjectStatus
from sentry.models import Repository
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.repository_mixin")


def update_repo(repo, repo_name, name_from_event, url_from_event=None, path_from_event=None):
    """
    Compare the repository data we currently have with the repository
    data coming in from a webhook. [name, url, and path]

    repo_name: use an arg instead of getting it off the repo because it
    can be either repo.name OR repo.config.get("name")

    """
    kwargs = {}
    if name_from_event and repo_name != name_from_event:
        kwargs["name"] = name_from_event
    if url_from_event and repo.url != url_from_event:
        kwargs["url"] = url_from_event
    # GitLab seems to be the only one to check the path, but if we need
    # to update, it seems like we update the config path in lieu of name
    if path_from_event and repo.config.get("path") != path_from_event:
        path = path_from_event
    if path:
        kwargs["config"] = dict(repo.config, path=path_from_event)

    if kwargs.get("name") and not path:
        kwargs["config"] = dict(repo.config, name=name_from_event)

    if len(kwargs) > 0:
        try:
            repo.update(**kwargs)
        except IntegrityError:
            logging_data = kwargs.copy()
            logging_data.update(dict(repo_id=repo.id, organization_id=repo.organization_id))
            logger.info(
                "update_repo_data.failed",
                extra=logging_data,
            )


class RepositoryMixin:
    # whether or not integration has the ability to search through Repositories
    # dynamically given a search query
    repo_search = False

    def format_source_url(self, repo, filepath, branch):
        """
        Formats the source code url used for stack trace linking.
        """
        raise NotImplementedError

    def check_file(self, repo, filepath, branch):
        """
        Calls the client's `check_file` method to see if the file exists.
        Returns the link to the file if it's exists, otherwise return `None`.

        So far only GitHub and GitLab have this implemented, both of which give use back 404s. If for some reason an integration gives back
        a different status code, this method could be overwritten.

        repo: Repository (object)
        filepath: file from the stacktrace (string)
        branch: commitsha or default_branch (string)
        """
        filepath = filepath.lstrip("/")
        try:
            resp = self.get_client().check_file(repo, filepath, branch)
            if resp is None:
                return None
        except ApiError as e:
            if e.code != 404:
                raise
            return None

        return self.format_source_url(repo, filepath, branch)

    def get_stacktrace_link(self, repo, filepath, default, version):
        """
        Handle formatting and returning back the stack trace link if the client
        request was successful.

        Uses the version first, and re-tries with the default branch if we 404
        trying to use the version (commit sha).

        If no file was found return `None`, and re-raise for non "Not Found" errors

        """
        with configure_scope() as scope:
            scope.set_tag("stacktrace_link.tried_version", False)
            if version:
                scope.set_tag("stacktrace_link.tried_version", True)
                source_url = self.check_file(repo, filepath, version)
                if source_url:
                    scope.set_tag("stacktrace_link.used_version", True)
                    return source_url
            scope.set_tag("stacktrace_link.used_version", False)
            source_url = self.check_file(repo, filepath, default)

        return source_url

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
