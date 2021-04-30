import logging

from rest_framework.response import Response

from sentry.plugins import providers


class CustomSCMRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = "CustomSCM"
    logger = logging.getLogger("sentry.integrations.custom_scm")

    def repository_external_slug(self, repo):
        return repo.name

    def dispatch(self, request, organization, **kwargs):
        # TODO(meredith): Add functionality to actually add a repo
        # to the manual integration.
        #   * update provider
        #   * update integration_id
        return Response(status=200)
