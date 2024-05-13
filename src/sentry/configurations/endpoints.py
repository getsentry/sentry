from django.db.utils import IntegrityError
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.configurations.models import ConfigurationFeatureModel, ConfigurationModel
from sentry.models.organization import Organization

# Validators.


class ConfigurationValidator(CamelSnakeSerializer):
    id = serializers.IntegerField(read_only=True)
    slug = SentrySerializerSlugField(
        max_length=32,
        required=True,
        help_text="Uniquely identifies a configuration within an organization.",
    )


class ConfigurationContainerValidator(CamelSnakeSerializer):
    data = ConfigurationValidator()


class ConfigurationFeatureValidator(CamelSnakeSerializer):
    id = serializers.UUIDField(read_only=True)
    key = serializers.CharField(
        help_text="Configuration feature key name.",
        max_length=32,
        required=True,
    )
    value = serializers.CharField(
        help_text="Configuration feature value.",
        max_length=1024,
        required=True,
    )


class ConfigurationFeatureContainerValidator(CamelSnakeSerializer):
    data = ConfigurationFeatureValidator()


# Serializers.


def _serialize_configuration_model(model: ConfigurationModel):
    return {"id": model.id, "slug": model.slug}


def _serialize_configuration_feature_model(model: ConfigurationFeatureModel):
    return {"id": model.id, "key": model.key, "value": model.value}


# Mixins.


class ConfigurationMixin:
    def convert_args(self, request: Request, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)

        cid = kwargs.pop("configuration_id")
        oid = kwargs["organization"].id

        try:
            c = ConfigurationModel.objects.filter(organization_id=oid).get(id=cid)
        except ConfigurationModel.DoesNotExist:
            raise ResourceDoesNotExist
        else:
            kwargs["configuration"] = c
            return args, kwargs


class ConfigurationFeatureMixin(ConfigurationMixin):
    def convert_args(self, request: Request, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)

        oid = kwargs["organization"].id
        cid = kwargs["configuration"].id
        fid = kwargs.pop("configuration_feature_id")

        try:
            f = ConfigurationFeatureModel.objects.filter(
                organization_id=oid,
                configuration_id=cid,
            ).get(fid)
        except ConfigurationFeatureModel.DoesNotExist:
            raise ResourceDoesNotExist
        else:
            kwargs["configuration_feature"] = f
            return (args, kwargs)


# Endpoints.


@region_silo_endpoint
class ConfigurationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CONFIGURATIONS
    permission_classes = (OrganizationEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        queryset = ConfigurationModel.objects.filter(organization_id=organization.id)
        return self.paginate(
            on_results=lambda models: {
                "data": [_serialize_configuration_model(model) for model in models],
            },
            paginator_cls=OffsetPaginator,
            queryset=queryset,
            request=request,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        validator = ConfigurationContainerValidator(
            data=request.data, context={"organization": organization}
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        try:
            model = ConfigurationModel.objects.create(
                organization_id=organization.id, **validator.validated_data["data"]
            )
        except IntegrityError:
            return Response("Slug is already in use", status=400)
        else:
            return Response({"data": _serialize_configuration_model(model)}, status=201)


@region_silo_endpoint
class ConfigurationEndpoint(ConfigurationMixin, OrganizationEndpoint):
    owner = ApiOwner.CONFIGURATIONS
    permission_classes = (OrganizationEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization, configuration: ConfigurationModel
    ) -> Response:
        return Response({"data": _serialize_configuration_model(configuration)}, status=200)

    def delete(
        self, request: Request, organization: Organization, configuration: ConfigurationModel
    ) -> Response:
        configuration.delete()
        return Response("", status=204)


@region_silo_endpoint
class ConfigurationFeaturesEndpoint(ConfigurationMixin, OrganizationEndpoint):
    owner = ApiOwner.CONFIGURATIONS
    permission_classes = (OrganizationEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization, configuration: ConfigurationModel
    ) -> Response:
        queryset = ConfigurationFeatureModel.objects.filter(
            organization_id=organization.id,
            configuration_id=configuration.id,
        )
        return self.paginate(
            on_results=lambda models: {
                "data": [_serialize_configuration_feature_model(model) for model in models],
            },
            paginator_cls=OffsetPaginator,
            queryset=queryset,
            request=request,
        )

    def post(
        self, request: Request, organization: Organization, configuration: ConfigurationModel
    ) -> Response:
        validator = ConfigurationContainerValidator(
            data=request.data, context={"organization": organization}
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        model = ConfigurationFeatureModel.objects.create(
            configuration_id=configuration.id,
            organization_id=organization.id,
            **validator.validated_data["data"],
        )

        return Response({"data": _serialize_configuration_feature_model(model)}, status=201)


@region_silo_endpoint
class ConfigurationFeatureEndpoint(ConfigurationFeatureMixin, OrganizationEndpoint):
    owner = ApiOwner.CONFIGURATIONS
    permission_classes = (OrganizationEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PATCH": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        organization: Organization,
        configuration: ConfigurationModel,
        configuration_feature: ConfigurationFeatureModel,
    ) -> Response:
        return Response(
            {
                "data": _serialize_configuration_feature_model(configuration_feature),
            },
            status=200,
        )

    def patch(
        self,
        request: Request,
        organization: Organization,
        configuration: ConfigurationModel,
        configuration_feature: ConfigurationFeatureModel,
    ) -> Response:
        validator = ConfigurationFeatureContainerValidator(
            data=request.data, context={"organization": organization}
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        configuration_feature.update(**validator.validated_data["data"])

        return Response(
            {
                "data": _serialize_configuration_feature_model(configuration_feature),
            },
            status=202,
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        configuration: ConfigurationModel,
        configuration_feature: ConfigurationFeatureModel,
    ) -> Response:
        configuration_feature.delete()
        return Response("", status=204)
