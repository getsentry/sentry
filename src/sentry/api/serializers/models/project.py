from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Project, ProjectBookmark, ProjectOption


@register(Project)
class ProjectSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if user.is_authenticated() and item_list:
            bookmarks = set(ProjectBookmark.objects.filter(
                user=user,
                project_id__in=[i.id for i in item_list],
            ).values_list('project_id', flat=True))
        else:
            bookmarks = set()

        reviewed_callsigns = {
            p.project_id: p.value
            for p in ProjectOption.objects.filter(
                project__in=item_list,
                key='sentry:reviewed-callsign',
            )
        }

        result = {}
        for item in item_list:
            result[item] = {
                'is_bookmarked': item.id in bookmarks,
                'reviewed-callsign': reviewed_callsigns.get(item.id),
            }
        return result

    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in ('event-types', 'global-events', 'user-reports', 'dsym'):
            if features.has('projects:' + feature, obj, actor=user):
                feature_list.append(feature)

        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'isBookmarked': attrs['is_bookmarked'],
            'callSign': obj.callsign,
            'color': obj.color,
            # TODO(mitsuhiko): eventually remove this when we will treat
            # all short names as reviewed.
            'callSignReviewed': bool(attrs['reviewed-callsign']),
            'dateCreated': obj.date_added,
            'firstEvent': obj.first_event,
            'features': feature_list,
        }
