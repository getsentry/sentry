from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.testutils.cases import TestCase
from sentry.types.grouphash_metadata import (
    FingerprintHashingMetadata,
    SaltedStacktraceHashingMetadata,
    StacktraceHashingMetadata,
)
from sentry.utils import json


class GetAssociatedFingerprintTest(TestCase):
    def test_simple(self):
        raw_fingerprint = ["maisey", "charlie", "{{ message }}"]
        resolved_fingerprint = ["maisey", "charlie", "Dogs are great!"]

        hashing_metadata: FingerprintHashingMetadata = {
            "fingerprint": json.dumps(resolved_fingerprint),
            "fingerprint_source": "client",
            "is_hybrid_fingerprint": False,
            "client_fingerprint": json.dumps(raw_fingerprint),
        }

        grouphash = GroupHash.objects.create(hash="yay dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() == resolved_fingerprint

    def test_hybrid_fingerprint(self):
        """
        Test that it works for events grouped on things other than fingerprint.
        """
        raw_fingerprint = ["{{ default }}", "maisey", "charlie", "{{ message }}"]
        resolved_fingerprint = ["{{ default }}", "maisey", "charlie", "Dogs are great!"]

        hashing_metadata: SaltedStacktraceHashingMetadata = {
            "stacktrace_type": "in-app",
            "stacktrace_location": "exception",
            "num_stacktraces": 1,
            "fingerprint": json.dumps(resolved_fingerprint),
            "fingerprint_source": "client",
            "is_hybrid_fingerprint": True,
            "client_fingerprint": json.dumps(raw_fingerprint),
        }

        grouphash = GroupHash.objects.create(hash="yay dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() == resolved_fingerprint

    def test_stringified_fingerprint(self):
        """
        Test handling of fingerprint metadata from back when we were stringifying rather than
        jsonifying the fingerprint value.
        """
        raw_fingerprint = ["maisey", "charlie", "{{ message }}"]
        resolved_fingerprint = ["maisey", "charlie", "Dogs are great!"]

        hashing_metadata: FingerprintHashingMetadata = {
            "fingerprint": str(resolved_fingerprint),
            "fingerprint_source": "client",
            "is_hybrid_fingerprint": False,
            "client_fingerprint": str(raw_fingerprint),
        }

        grouphash = GroupHash.objects.create(hash="yay dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() is None

    def test_no_metadata(self):
        grouphash = GroupHash.objects.create(hash="yay dogs", project_id=self.project.id)

        assert grouphash.metadata is None
        assert grouphash.get_associated_fingerprint() is None

    def test_no_hashing_metadata(self):
        grouphash = GroupHash.objects.create(hash="yay dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash)

        assert grouphash.metadata and grouphash.metadata.hashing_metadata is None
        assert grouphash.get_associated_fingerprint() is None

    def test_no_fingerprint(self):
        hashing_metadata: StacktraceHashingMetadata = {
            "stacktrace_type": "in-app",
            "stacktrace_location": "exception",
            "num_stacktraces": 1,
        }

        grouphash = GroupHash.objects.create(hash="yay dogs", project_id=self.project.id)
        GroupHashMetadata.objects.create(grouphash=grouphash, hashing_metadata=hashing_metadata)

        assert grouphash.get_associated_fingerprint() is None
