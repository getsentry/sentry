from sentry.api.serializers import Serializer


class CodeLocationsSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def _compute_attrs(self, item):
        return {
            "mri": item.query.metric_mri,
            "timestamp": item.query.timestamp,
            "codeLocations": [location.__dict__ for location in item.code_locations],
        }

    def get_attrs(self, item_list, user):
        return {item: self._compute_attrs(item) for item in item_list}

    def serialize(self, obj, attrs, user):
        return {
            "mri": attrs["mri"],
            "timestamp": attrs["timestamp"],
            "codeLocations": attrs["codeLocations"],
        }
