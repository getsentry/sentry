from sentry.api.serializers import Serializer


class CodeLocationsSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def _compute_attrs(self, item):
        return {
            "mri": item.query.metric_mri,
            "timestamp": item.query.timestamp,
            "frames": [location.__dict__ for location in item.frames],
        }

    def get_attrs(self, item_list, user):
        return {item: self._compute_attrs(item) for item in item_list}

    def _serialize_code_location_payload(self, code_location_payload):
        return {
            "function": code_location_payload.get("function"),
            "module": code_location_payload.get("module"),
            "filename": code_location_payload.get("filename"),
            "absPath": code_location_payload.get("abs_path"),
            "lineNo": code_location_payload.get("lineno"),
            "preContext": code_location_payload.get("pre_context"),
            "contextLine": code_location_payload.get("context_line"),
            "postContext": code_location_payload.get("post_context"),
        }

    def serialize(self, obj, attrs, user):
        return {
            "mri": attrs["mri"],
            "timestamp": attrs["timestamp"],
            "frames": [
                self._serialize_code_location_payload(location) for location in attrs["frames"]
            ],
        }
