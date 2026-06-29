from sentry.api.serializers import Serializer, register
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion


@register(WeeklyReportProjectExclusion)
class WeeklyReportProjectExclusionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "projectSlug": obj.project.slug,
            "dateAdded": obj.date_added,
        }
