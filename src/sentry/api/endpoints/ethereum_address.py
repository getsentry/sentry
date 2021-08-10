from pytz import timezone
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.models.ethereum_address import EthereumAddressSerializer
from sentry.models import EthereumAddress


class EthereumAddressesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """Get all address filters for the project"""
        addresses = EthereumAddress.objects.filter(project=project)
        serializer = EthereumAddressSerializer(addresses, many=True)
        # TODO: paginate?
        # FIXME: use Sentry Model serializer?
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


class EthereumAddressDetailsEndpoint(ProjectEndpoint):
    def put(self, request, project, address_id):
        """Update the address"""
        try:
            address = EthereumAddress.objects.filter(project=project, id=address_id).get()
        except EthereumAddress.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = EthereumAddressSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.validated_data

            address.display_name = result["displayName"]
            address.abi_contents = result["abiContents"]
            address.last_updated = timezone.now()

            address.save()
        else:
            return Response(serializer.errors, status=400)

    def delete(self, request, project, address_id):
        """Delete the address"""
        try:
            address = EthereumAddress.objects.filter(project=project, id=address_id).get()
        except EthereumAddress.DoesNotExist:
            raise ResourceDoesNotExist

        address.delete()
        return self.respond(status=204)
