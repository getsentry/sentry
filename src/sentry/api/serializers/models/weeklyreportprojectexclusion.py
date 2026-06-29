from sentry.api.serializers import Serializer, register
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion


@register(WeeklyReportProjectExclusion)
class WeeklyReportProjectExclusionSerializer(Serializer):
    def serialize(
        self, obj: WeeklyReportProjectExclusion, attrs: object, user: object, **kwargs: object
    ) -> dict[str, object]:
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "projectSlug": obj.project.slug,
            "dateAdded": obj.date_added,
        }
