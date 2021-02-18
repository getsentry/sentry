import logging

from django.db import IntegrityError
from django.http import Http404

from rest_framework import serializers, status
from rest_framework.response import Response
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer

from sentry.api.bases.organization import OrganizationEndpoint

from sentry.api.serializers import serialize
from sentry.models import ExternalUser, EXTERNAL_PROVIDERS, OrganizationMember

logger = logging.getLogger(__name__)


class ExternalUserSerializer(CamelSnakeModelSerializer):
    organizationmember_id = serializers.IntegerField(required=True)
    external_name = serializers.CharField(required=True)
    provider = serializers.ChoiceField(choices=list(EXTERNAL_PROVIDERS.values()))

    class Meta:
        model = ExternalUser
        fields = ["organizationmember_id", "external_name", "provider"]

    def validate_provider(self, provider):
        if provider not in EXTERNAL_PROVIDERS.values():
            raise serializers.ValidationError(
                f'The provider "{provider}" is not supported. We currently accept Github and Gitlab user identities.'
            )
        return ExternalUser.get_provider_enum(provider)

    def create(self, validated_data):
        return ExternalUser.objects.get_or_create(**validated_data)

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


class ExternalUserEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, user_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        try:
            kwargs["organization_member"] = OrganizationMember.objects.get(
                id=user_id, organization=kwargs["organization"]
            )
        except OrganizationMember.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def post(self, request, organization, organization_member):
        """
        Create an External User
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          user belongs to.
        :pparam string user_id: the organization_member id.
        :param required string provider: enum("github", "gitlab")
        :param required string external_name: the associated Github/Gitlab user name.
        :auth: required
        """
        serializer = ExternalUserSerializer(
            data={**request.data, "organizationmember_id": organization_member.id}
        )
        if serializer.is_valid():
            external_user, created = serializer.save()
            status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(serialize(external_user, request.user), status=status_code)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
