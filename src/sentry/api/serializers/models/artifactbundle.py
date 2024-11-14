import base64

from sentry.api.serializers import Serializer
from sentry.models.artifactbundle import ReleaseArtifactBundle, SourceFileType

INVALID_SOURCE_FILE_TYPE = 0


class ArtifactBundlesSerializer(Serializer):
    @staticmethod
    def _compute_associations(item, grouped_bundles):
        associations = []

        grouped_bundle = grouped_bundles.get(item[0], [])
        # We preserve the order of the list inside the grouped bundle.
        for release, dist in grouped_bundle:
            associations.append({"release": release or None, "dist": dist or None})

        return associations

    @staticmethod
    def _format_date(date):
        return None if date is None else date.isoformat()[:19] + "Z"

    def get_attrs(self, item_list, user, **kwargs):
        # We sort by id, since it's the best (already existing) field to define total order of
        # release associations that is somehow consistent with upload sequence.
        release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
            artifact_bundle_id__in=[r[0] for r in item_list]
        ).order_by("-id")

        grouped_bundles: dict[int, list[tuple[str, str]]] = {}
        for release in release_artifact_bundles:
            bundles = grouped_bundles.setdefault(release.artifact_bundle_id, [])
            bundles.append((release.release_name, release.dist_name))

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

    def serialize(self, obj, attrs, user, **kwargs):
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

    def get_attrs(self, item_list, user, **kwargs):
        return {item: self._compute_attrs(item) for item in item_list}

    def _compute_attrs(self, item):
        file_path = item.file_path
        info = item.info

        headers = self.archive.normalize_headers(info.get("headers", {}))
        debug_id = self.archive.normalize_debug_id(headers.get("debug-id"))
        sourcemap = headers.get("sourcemap")

        return {
            "file_type": SourceFileType.from_lowercase_key(info.get("type")),
            "file_path": file_path,
            "file_url": self.archive.get_file_url_by_file_path(file_path),
            "file_info": self.archive.get_file_info(file_path),
            "debug_id": debug_id,
            "sourcemap": sourcemap,
        }

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": base64.urlsafe_b64encode(attrs["file_path"].encode()).decode(),
            # In case the file type string was invalid, we return the sentinel value INVALID_SOURCE_FILE_TYPE.
            "fileType": (
                attrs["file_type"].value
                if attrs["file_type"] is not None
                else INVALID_SOURCE_FILE_TYPE
            ),
            # We decided to return the file url as file path for better searchability.
            "filePath": attrs["file_url"],
            "fileSize": attrs["file_info"].file_size if attrs["file_info"] is not None else None,
            "debugId": attrs["debug_id"],
            "sourcemap": attrs["sourcemap"],
        }
