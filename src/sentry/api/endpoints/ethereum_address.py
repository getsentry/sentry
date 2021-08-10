from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.ethereum_address import EthereumAddressSerializer
from sentry.models import EthereumAddress


@register(EthereumAddress)
class EthereumAddressGetSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "address": obj.address,
            "abiContents": obj.abi_contents,
            "displayName": obj.display_name,
            "lastUpdated": obj.last_updated,
        }


class EthereumAddressesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """Get all address filters for the project"""
        # TODO: paginate?
        addresses = list(EthereumAddress.objects.filter(project=project))
        return Response(serialize(addresses, request.user, EthereumAddressGetSerializer()))

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

            return Response(
                serialize(address, request.user, EthereumAddressGetSerializer()), status=201
            )
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

            address.abi_contents = result["abiContents"]
            address.display_name = result["displayName"]
            address.last_updated = timezone.now()

            address.save()

            return Response(
                serialize(address, request.user, EthereumAddressGetSerializer()), status=200
            )
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
