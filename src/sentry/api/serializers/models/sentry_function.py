from sentry.api.serializers import Serializer, register
from sentry.models.sentryfunction import SentryFunction


@register(SentryFunction)
class SentryFunctionSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        events = [event for event in obj.events]
        # convert from map to array
        env_variables = map(lambda x: {"name": x[0], "value": x[1]}, obj.env_variables.items())
        data = {
            "name": obj.name,
            "code": obj.code,
            "slug": obj.slug,
            "author": obj.author,
            "overview": obj.overview,
            "events": events,
            "envVariables": env_variables,
        }

        return data
