from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationAdminPermission
from sentry.conf.server import SENTRY_EARLY_FEATURES
from sentry.models.organization import Organization


@region_silo_endpoint
class InternalEAFeaturesEndpoint(Endpoint):
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request):
        features_dict = features.all()

        ea_org = Organization()
        ea_org.flags.early_adopter = True

        ea_features = [
            feature_name for feature_name in features_dict if features.has(feature_name, ea_org)
        ]

        missing_from_self_hosted = [
            feature for feature in ea_features if feature not in SENTRY_EARLY_FEATURES
        ]

        return Response(
            {"ea_features": ea_features, "missing_from_self_hosted": missing_from_self_hosted}
        )
