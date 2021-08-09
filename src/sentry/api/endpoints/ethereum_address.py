from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers.models.ethereum_address import EthereumAddressSerializer
from sentry.models import EthereumAddress


class EthereumAddressesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectPermission,)

    def get(self, request, project):
        """Get all address filters for the project"""
        addresses = EthereumAddress.objects.filter(project=project)
        serializer = EthereumAddressSerializer(addresses, many=True)
        # TODO: paginate?
        return Response(serializer.data)

    def post(self, request, project):
        """Create an address filter"""
        serializer = EthereumAddressSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.validated_data

            address = EthereumAddress.objects.create(
                project=project,
                address=result["address"],
                abi_contents=result["abiContents"],
                display_name=result["displayName"],
            )

            return Response(EthereumAddressSerializer(address), status=201)
        return Response(serializer.errors, status=400)
