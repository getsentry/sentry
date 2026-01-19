from rest_framework import serializers


class RepositoryInfoSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)  # "owner/repo" format
    base_commit_sha = serializers.CharField(required=True, min_length=40, max_length=40)

    def validate_name(self, value):
        """Validate repository name is in owner/repo format."""
        if "/" not in value or value.count("/") != 1:
            raise serializers.ValidationError("Repository name must be in 'owner/repo' format")
        owner, repo = value.split("/")
        if not owner or not repo:
            raise serializers.ValidationError("Repository name must be in 'owner/repo' format")
        return value

    def validate_base_commit_sha(self, value):
        """Validate that base_commit_sha is a valid 40-character hex string"""
        if not all(c in "0123456789abcdefABCDEF" for c in value):
            raise serializers.ValidationError(
                "base_commit_sha must be a valid 40-character hexadecimal string"
            )
        return value


class CodeReviewLocalRequestSerializer(serializers.Serializer):
    repository = RepositoryInfoSerializer(required=True)
    diff = serializers.CharField(required=True, max_length=500_000)
    current_branch = serializers.CharField(required=False, max_length=255)
    commit_message = serializers.CharField(required=False, max_length=1000)

    def validate_diff(self, value):
        """Validate diff constraints from Seer requirements"""
        # Check size in bytes
        size_bytes = len(value.encode("utf-8"))
        if size_bytes > 500_000:
            raise serializers.ValidationError("Diff exceeds 500KB limit")

        # Count files changed
        file_count = value.count("diff --git")
        if file_count > 50:
            raise serializers.ValidationError("Diff contains too many files (max 50)")

        if file_count == 0:
            raise serializers.ValidationError("Diff appears to be empty or invalid")

        return value
