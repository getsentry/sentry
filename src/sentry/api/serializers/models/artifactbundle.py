from sentry.api.serializers import Serializer
from sentry.models import ReleaseArtifactBundle


class ArtifactBundlesSerializer(Serializer):
    def get_attrs(self, item_list, user):
        release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
            artifact_bundle_id__in=[r.id for r in item_list]
        )
        release_artifact_bundles = {
            release.artifact_bundle_id: (release.release_name, release.dist_name)
            for release in release_artifact_bundles
        }

        return {
            item: {
                "bundle_id": item.bundle_id,
                "release": release_artifact_bundles.get(item.id, (None, None))[0],
                "dist": release_artifact_bundles.get(item.id, (None, None))[1],
                "file_count": item.artifact_count,
                "date": item.date_uploaded,
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
