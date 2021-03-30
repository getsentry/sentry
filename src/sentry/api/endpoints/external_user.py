import logging

from django.db import IntegrityError
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models import EXTERNAL_PROVIDERS, ExternalUser, OrganizationMember

logger = logging.getLogger(__name__)


class ExternalUserSerializer(CamelSnakeModelSerializer):
    member_id = serializers.IntegerField(required=True)
    external_name = serializers.CharField(required=True)
    provider = serializers.ChoiceField(choices=list(EXTERNAL_PROVIDERS.values()))

    class Meta:
        model = ExternalUser
        fields = ["member_id", "external_name", "provider"]

    def validate_provider(self, provider):
        if provider not in EXTERNAL_PROVIDERS.values():
            raise serializers.ValidationError(
                f'The provider "{provider}" is not supported. We currently accept Github and Gitlab user identities.'
            )
        return ExternalUser.get_provider_enum(provider)

    def validate_member_id(self, member_id):
        try:
            return OrganizationMember.objects.get(
                id=member_id, organization=self.context["organization"]
            )
        except OrganizationMember.DoesNotExists:
            raise serializers.ValidationError("This member does not exist.")

    def create(self, validated_data):
        organizationmember = validated_data.pop("member_id", None)
        return ExternalUser.objects.get_or_create(
            organizationmember=organizationmember, **validated_data
        )

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        try:
            self.instance.save()
            return self.instance
        except IntegrityError:
            raise serializers.ValidationError(
                "There already exists an external user association with this external_name and provider."
            )


class ExternalUserMixin:
    def has_feature(self, request, organization):
        return features.has("organizations:import-codeowners", organization, actor=request.user)


class ExternalUserEndpoint(OrganizationEndpoint, ExternalUserMixin):
    def post(self, request, organization):
        """
        Create an External User
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          user belongs to.
        :param required string provider: enum("github", "gitlab")
        :param required string external_name: the associated Github/Gitlab user name.
        :param required int member_id: the organization_member id.
        :auth: required
        """
        if not self.has_feature(request, organization):
            raise PermissionDenied

        serializer = ExternalUserSerializer(
            context={"organization": organization}, data={**request.data}
        )
        if serializer.is_valid():
            external_user, created = serializer.save()
            status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(serialize(external_user, request.user), status=status_code)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
