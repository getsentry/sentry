from logging import getLogger

from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.exceptions import PluginError
from sentry.models import Repository
from sentry.plugins.config import ConfigValidator
from sentry.signals import repo_linked

from .base import ProviderMixin

logger = getLogger("sentry.integrations")


class RepositoryProvider(ProviderMixin):
    """
    Plugin Repository Provider
    Includes all plugins such as those in sentry-plugins repo
    as well as any outside plugin respoitories (i.e. Trello, Youtrack).
    Does not include the integrations in the sentry repository.
    """

    name = None

    def __init__(self, id):
        self.id = id

    def dispatch(self, request, organization, **kwargs):
        if self.needs_auth(request.user):
            # TODO(dcramer): this should be a 401
            return Response(
                {
                    "error_type": "auth",
                    "auth_url": reverse("socialauth_associate", args=[self.auth_provider]),
                },
                status=400,
            )

        try:
            fields = self.get_config()
        except Exception as e:
            return self.handle_api_error(e)

        if request.method == "GET":
            return Response(fields)

        validator = ConfigValidator(fields, request.data)
        if not validator.is_valid():
            return Response({"error_type": "validation", "errors": validator.errors}, status=400)

        try:
            config = self.validate_config(organization, validator.result, actor=request.user)
        except Exception as e:
            return self.handle_api_error(e)

        try:
            result = self.create_repository(
                organization=organization, data=config, actor=request.user
            )
        except PluginError as e:
            logger.exception("repo.create-error")
            return Response({"errors": {"__all__": str(e)}}, status=400)

        try:
            with transaction.atomic():
                repo = Repository.objects.create(
                    organization_id=organization.id,
                    name=result["name"],
                    external_id=result.get("external_id"),
                    url=result.get("url"),
                    config=result.get("config") or {},
                    provider=self.id,
                )
        except IntegrityError:
            # Try to delete webhook we just created
            try:
                repo = Repository(
                    organization_id=organization.id,
                    name=result["name"],
                    external_id=result.get("external_id"),
                    url=result.get("url"),
                    config=result.get("config") or {},
                    provider=self.id,
                )
                self.delete_repository(repo, actor=request.user)
            except PluginError:
                pass
            return Response(
                {"errors": {"__all__": "A repository with that name already exists"}}, status=400
            )
        else:
            repo_linked.send_robust(repo=repo, user=request.user, sender=self.__class__)

        return Response(serialize(repo, request.user), status=201)

    def get_config(self):
        raise NotImplementedError

    def validate_config(self, organization, config, actor=None):
        return config

    def create_repository(self, organization, data, actor=None):
        raise NotImplementedError

    def delete_repository(self, repo, actor=None):
        pass

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        raise NotImplementedError

    def pull_request_url(self, repo, pull_request):
        """
        Generate a URL to a pull request on the repository provider.
        """
        return None

    def repository_external_slug(self, repo):
        """
        Generate the public facing 'external_slug' for a repository
        The shape of this id must match the `identifier` returned by
        the Plugin's get repositories method
        """
        return None

    @staticmethod
    def should_ignore_commit(message):
        return "#skipsentry" in message
