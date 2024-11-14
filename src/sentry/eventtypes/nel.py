from .base import DefaultEvent


class NelEvent(DefaultEvent):
    key = "nel"

    def extract_metadata(self, data):
        metadata = super().extract_metadata(data)
        metadata["uri"] = data.get("request").get("url")
        return metadata
