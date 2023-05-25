import base64

from sentry.api.serializers import Serializer
from sentry.models import SourceFileType

INVALID_SOURCE_FILE_TYPE = 0


class ArtifactBundlesSerializer(Serializer):
    def get_attrs(self, item_list, user):
        return {
            item: {
                "bundle_id": item[0],
                "release": item[1],
                "dist": item[2],
                "file_count": item[3],
                "date": item[4],
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            "bundleId": str(attrs["bundle_id"]),
            "release": attrs["release"] if attrs["release"] != "" else None,
            "dist": attrs["dist"] if attrs["dist"] != "" else None,
            "fileCount": attrs["file_count"],
            "date": attrs["date"].isoformat()[:19] + "Z",
        }


class ArtifactBundleFilesSerializer(Serializer):
    def __init__(self, archive, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)
        self.archive = archive

    def get_attrs(self, item_list, user):
        return {item: self._compute_attrs(item) for item in item_list}

    def _compute_attrs(self, item):
        file_path = item.file_path
        info = item.info

        headers = self.archive.normalize_headers(info.get("headers", {}))
        debug_id = self.archive.normalize_debug_id(headers.get("debug-id"))

        return {
            "file_type": SourceFileType.from_lowercase_key(info.get("type")),
            "file_path": file_path,
            "file_url": self.archive.get_file_url_by_file_path(file_path),
            "file_info": self.archive.get_file_info(file_path),
            "debug_id": debug_id,
        }

    def serialize(self, obj, attrs, user):
        return {
            "id": base64.urlsafe_b64encode(bytes(attrs["file_path"].encode("utf-8"))).decode(
                "utf-8"
            ),
            # In case the file type string was invalid, we return the sentinel value INVALID_SOURCE_FILE_TYPE.
            "fileType": attrs["file_type"].value
            if attrs["file_type"] is not None
            else INVALID_SOURCE_FILE_TYPE,
            # We decided to return the file url as file path for better searchability.
            "filePath": attrs["file_url"],
            "fileSize": attrs["file_info"].file_size if attrs["file_info"] is not None else None,
            "debugId": attrs["debug_id"],
        }
