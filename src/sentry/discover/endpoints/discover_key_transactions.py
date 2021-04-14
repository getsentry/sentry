from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.api.bases import KeyTransactionBase
from sentry.api.bases.organization import OrganizationPermission
from sentry.discover.endpoints.serializers import KeyTransactionSerializer
from sentry.discover.models import KeyTransaction


class KeyTransactionPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
        "PUT": ["org:read"],
        "DELETE": ["org:read"],
    }


class IsKeyTransactionEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def get(self, request, organization):
        """ Get the Key Transactions for a user """
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)

        transaction = request.GET.get("transaction")

        try:
            KeyTransaction.objects.get(
                organization=organization,
                owner=request.user,
                project=project,
                transaction=transaction,
            )
            return Response({"isKey": True}, status=200)
        except KeyTransaction.DoesNotExist:
            return Response({"isKey": False}, status=200)


class KeyTransactionEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def post(self, request, organization):
        """ Create a Key Transaction """
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)

        base_filter = {"organization": organization, "owner": request.user}

        with transaction.atomic():
            serializer = KeyTransactionSerializer(data=request.data, context=base_filter)
            if serializer.is_valid():
                data = serializer.validated_data
                base_filter["transaction"] = data["transaction"]
                base_filter["project"] = project

                if KeyTransaction.objects.filter(**base_filter).exists():
                    return Response(status=204)

                try:
                    KeyTransaction.objects.create(**base_filter)
                    return Response(status=201)
                # Even though we tried to avoid it, this KeyTransaction was created already
                except IntegrityError:
                    return Response(status=204)
            return Response(serializer.errors, status=400)

    def delete(self, request, organization):
        """ Remove a Key transaction for a user """
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)
        transaction = request.data["transaction"]

        try:
            model = KeyTransaction.objects.get(
                transaction=transaction,
                organization=organization,
                project=project,
                owner=request.user,
            )
        except KeyTransaction.DoesNotExist:
            return Response(status=204)

        model.delete()

        return Response(status=204)
