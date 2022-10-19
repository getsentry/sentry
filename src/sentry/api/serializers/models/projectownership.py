from sentry.api.serializers import Serializer, register
from sentry.models import ProjectOwnership


@register(ProjectOwnership)
class ProjectOwnershipSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        assignment = (
            "Auto Assign to Suspect Commits"
            if obj.auto_assignment and obj.suspect_committer_auto_assignment
            else "Auto Assign to Issue Owner"
            if obj.auto_assignment and not obj.suspect_committer_auto_assignment
            else "Turn off Auto-Assignment"
        )

        return {
            "raw": obj.raw,
            # Should we expose this?
            # 'schema': obj.schema,
            "fallthrough": obj.fallthrough,
            "dateCreated": obj.date_created,
            "lastUpdated": obj.last_updated,
            "isActive": obj.is_active,
            "autoAssignment": assignment,
            "codeownersAutoSync": obj.codeowners_auto_sync,
        }
