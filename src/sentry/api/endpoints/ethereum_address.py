from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.ethereum_address import EthereumAddressSerializer
from sentry.models import EthereumAddress


class EthereumAddressesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectPermission,)

    def get(self, request, project):
        addresses = list(EthereumAddress.objects.filter(project=project))
        return Response(serialize(addresses, request.user, EthereumAddressSerializer()))

    def post(self, request, project):
        EthereumAddress.objects.create(
            project=project,
            address="1234123412341234123412341234123412341234123412342134123412341234",
            display_name="bla",
        )
