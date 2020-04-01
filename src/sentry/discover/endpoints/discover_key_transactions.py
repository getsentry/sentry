from __future__ import absolute_import

from django.db import transaction
from rest_framework.response import Response

from sentry.api.bases import KeyTransactionBase
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.discover.models import KeyTransaction
from sentry.discover.endpoints.serializers import KeyTransactionSerializer
from sentry.snuba.discover import key_transaction_query, key_transaction_timeseries_query


class IsKeyTransactionEndpoint(KeyTransactionBase):
    permission_classes = (OrganizationPermission,)

    def get(self, request, organization):
        """ Get the Key Transactions for a user """
        if not self.has_feature(request, organization):
            return self.response(status=404)

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
    permission_classes = (OrganizationPermission,)

    def post(self, request, organization):
        """ Create a Key Transaction """
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)

        base_filter = {"organization": organization, "project": project, "owner": request.user}

        with transaction.atomic():
            serializer = KeyTransactionSerializer(data=request.data, context=base_filter)
            if serializer.is_valid():
                data = serializer.validated_data
                base_filter["transaction"] = data["transaction"]

                KeyTransaction.objects.create(**base_filter)
                return Response(status=201)
            return Response(serializer.errors, status=400)

    def get(self, request, organization):
        """ Get the Key Transactions for a user """
        if not self.has_feature(request, organization):
            return self.response(status=404)

        params = self.get_filter_params(request, organization)
        fields = request.GET.getlist("field")[:]
        orderby = self.get_orderby(request)

        queryset = KeyTransaction.objects.filter(organization=organization, owner=request.user)

        if not queryset.exists():
            raise ResourceDoesNotExist

        results = key_transaction_query(
            fields, request.GET.get("query"), params, orderby, "discover.key_transactions", queryset
        )

        return Response(
            self.handle_results_with_meta(request, organization, params["project_id"], results),
            status=200,
        )

    def delete(self, request, organization):
        """ Remove a Key transaction for a user """
        if not self.has_feature(request, organization):
            return self.response(status=404)

        project = self.get_project(request, organization)
        transaction = request.data["transaction"]

        try:
            model = KeyTransaction.objects.get(
                transaction=transaction, organization=organization, project=project
            )
        except KeyTransaction.DoesNotExist:
            raise ResourceDoesNotExist

        model.delete()

        return Response(status=204)


class KeyTransactionStatsEndpoint(KeyTransactionBase):
    permission_classes = (OrganizationPermission,)

    def get(self, request, organization):
        """ Get the Key Transactions for a user """
        if not self.has_feature(request, organization):
            return self.response(status=404)

        queryset = KeyTransaction.objects.filter(organization=organization, owner=request.user)
        if not queryset.exists():
            raise ResourceDoesNotExist

        def get_event_stats(query_columns, query, params, rollup, reference_event=None):
            return key_transaction_timeseries_query(
                selected_columns=query_columns,
                query=query,
                params=params,
                rollup=rollup,
                referrer="api.organization-event-stats.key-transactions",
                queryset=queryset,
            )

        return Response(
            self.get_event_stats_data(request, organization, get_event_stats), status=200
        )
