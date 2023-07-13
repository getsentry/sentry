from datetime import datetime, timedelta

from sentry.debug_files.bundle_index import BundleIndex, BundleMeta


def test_bundle_index_mutation():
    now = datetime.now()

    bundle_1_meta = BundleMeta(1, now)
    bundle_1_manifest = {
        "files": {
            "only_12": {
                "url": "~/in/1/and/2",
            },
            "all_3": {
                "url": "~/in/all/3",
            },
        }
    }

    bundle_2_meta = BundleMeta(2, now - timedelta(minutes=1))
    bundle_2_manifest = {
        "files": {
            "only_12": {
                "url": "~/in/1/and/2",
            },
            "all_3": {
                "url": "~/in/all/3",
            },
        }
    }

    bundle_3_meta = BundleMeta(3, now + timedelta(minutes=1))
    bundle_3_manifest = {
        "files": {
            "all_3": {
                "url": "~/in/all/3",
            },
        }
    }

    index = BundleIndex()
    index.merge_bundle_manifest(bundle_1_meta, bundle_1_manifest)

    index.merge_bundle_manifest(bundle_2_meta, bundle_2_manifest)
    assert index.get_meta_by_url("~/in/1/and/2") == bundle_1_meta
    assert index.get_meta_by_url("~/in/all/3") == bundle_1_meta

    index.merge_bundle_manifest(bundle_3_meta, bundle_3_manifest)
    assert index.get_meta_by_url("~/in/1/and/2") == bundle_1_meta
    assert index.get_meta_by_url("~/in/all/3") == bundle_3_meta

    index.remove_bundle_from_index(bundle_1_meta.id)
    assert index.get_meta_by_url("~/in/1/and/2") == bundle_2_meta
    assert index.get_meta_by_url("~/in/all/3") == bundle_3_meta
