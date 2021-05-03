from rest_framework import status

from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Feature, IntegrationFeature


class SentryAppFeaturesEndpoint(SentryAppBaseEndpoint):
    def get(self, request, sentry_app):
        features = IntegrationFeature.objects.filter(sentry_app_id=sentry_app.id)

        return self.paginate(
            request=request,
            queryset=features,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def put(self, request, sentry_app):

        current = request.data.get("current")
        value = request.data.get("value")

        features_dict = dict(Feature.as_choices())
        if not current or not features_dict[current]:
            return self.respond(
                '"current": ["This field is required."]', status=status.HTTP_400_BAD_REQUEST
            )

        if not value or not features_dict[value]:
            return self.respond(
                '"value": ["This field is required."]', status=status.HTTP_400_BAD_REQUEST
            )

        IntegrationFeature.objects.filter(sentry_app_id=sentry_app.id, feature=current).update(
            feature=value
        )

        features = IntegrationFeature.objects.filter(sentry_app_id=sentry_app.id)
        return self.respond(map(lambda x: serialize(x, request.user), features), status=200)
