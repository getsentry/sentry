from django.db.models import Q
from rest_framework import serializers

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.db.models.fields.bounded import BoundedAutoField
from sentry.models import OrganizationMember

from .organization import OrganizationEndpoint


class MemberSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=0, max_value=BoundedAutoField.MAX_VALUE, required=True)


class OrganizationMemberEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, member_id="me", *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug)

        serializer = MemberSerializer(data={"id": member_id})
        if serializer.is_valid():
            result = serializer.validated_data
            try:
                kwargs["member"] = self._get_member(request, kwargs["organization"], result["id"])
            except OrganizationMember.DoesNotExist:
                raise ResourceDoesNotExist

            return (args, kwargs)
        else:
            raise ResourceDoesNotExist

    def _get_member(self, request, organization, member_id):
        if member_id == "me":
            queryset = OrganizationMember.objects.filter(
                organization=organization, user__id=request.user.id, user__is_active=True
            )
        else:
            queryset = OrganizationMember.objects.filter(
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
                id=member_id,
            )
        return queryset.select_related("user").get()
