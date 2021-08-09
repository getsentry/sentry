from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.models import EthereumAddress


class EthereumAddressEndpoint(ProjectEndpoint):
    permission_classes = (ProjectPermission,)

    def get(self, request, project):
        addresses = EthereumAddress.objects.filter(project=project)
        return Response(serialize(addresses, request.user))

    def post(self, request, project):
        EthereumAddress.objects.create(
            project=project,
            address="0x1234123412341234123412341234123412341234123412342134123412341234",
            display_name="bla",
        )
