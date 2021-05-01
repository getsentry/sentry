import logging

from django.http import Http404
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.models import Integration, Repository
from sentry.plugins import providers


class CustomSCMRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = "CustomSCM"
    logger = logging.getLogger("sentry.integrations.custom_scm")

    def repository_external_slug(self, repo):
        return repo.name

    def dispatch(self, request, organization, **kwargs):
        """
        Adding a repository to the Custom SCM integration is
        just two steps:
           1. Change the provider from `null` to 'integrations:custom_scm'
           2. Add the integration_id that is passed from the request
        """
        repo_id = request.data.get("identifier")
        integration_id = request.data.get("installation")

        try:
            # double check the repository_id passed is not
            # for an already 'claimed' repository
            repo = Repository.objects.get(
                organization_id=organization.id,
                id=repo_id,
                integration_id__isnull=True,
                provider__isnull=True,
            )
            integration = Integration.objects.get(organizations=organization, id=integration_id)
        except (Repository.DoesNotExist, Integration.DoesNotExist):
            raise Http404

        repo.provider = "integrations:custom_scm"
        repo.integration_id = integration.id
        repo.save()

        return Response(serialize(repo, request.user), status=200)
