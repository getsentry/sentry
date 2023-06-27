import base64
from collections import defaultdict

from sentry.api.serializers import Serializer
from sentry.models import ReleaseArtifactBundle, SourceFileType

INVALID_SOURCE_FILE_TYPE = 0


class ArtifactBundlesSerializer(Serializer):
    @staticmethod
    def _compute_associations(item, grouped_bundles):
        associations = []

        grouped_bundle = grouped_bundles.get(item[0], [])
        # We want to sort the set, since we want consistent ordering in the UI.
        for release, dist in sorted(grouped_bundle):
            associations.append({"release": release or None, "dist": dist or None})

        return associations

    @staticmethod
    def _format_date(date):
        return None if date is None else date.isoformat()[:19] + "Z"

    def get_attrs(self, item_list, user):
        release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
            artifact_bundle_id__in=[r[0] for r in item_list]
        )

        grouped_bundles = defaultdict(set)
        for release in release_artifact_bundles:
            grouped_bundles[release.artifact_bundle_id].add(
                (release.release_name, release.dist_name)
            )

        return {
            item: {
                "bundle_id": item[1],
                "associations": self._compute_associations(item, grouped_bundles),
                "file_count": item[2],
                "date_last_modified": item[3],
                "date_uploaded": item[4],
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            "bundleId": str(attrs["bundle_id"]),
            "associations": attrs["associations"],
            "fileCount": attrs["file_count"],
            "dateModified": self._format_date(attrs["date_last_modified"]),
            "date": self._format_date(attrs["date_uploaded"]),
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
