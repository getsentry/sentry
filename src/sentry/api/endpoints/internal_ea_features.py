from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationAdminPermission
from sentry.conf.server import SENTRY_EARLY_FEATURES
from sentry.models.organization import Organization


@region_silo_endpoint
class InternalEAFeaturesEndpoint(Endpoint):
    permission_classes = (OrganizationAdminPermission,)
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request):
        features_dict = features.all()

        ea_org = Organization()
        ea_org.flags.early_adopter = True

        features_batch = features.batch_has(list(features_dict.keys()), organization=ea_org)
        all_features_dict = (
            features_batch.get(f"organization:{ea_org.id}", {}) if features_batch else {}
        )

        ea_features = list(filter(lambda key: all_features_dict[key], all_features_dict))

        missing_from_self_hosted = [
            feature for feature in ea_features if feature not in SENTRY_EARLY_FEATURES
        ]

        return Response(
            {"ea_features": ea_features, "missing_from_self_hosted": missing_from_self_hosted}
        )
