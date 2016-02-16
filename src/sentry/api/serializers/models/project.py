from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Project, ProjectBookmark


@register(Project)
class ProjectSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if user.is_authenticated() and item_list:
            bookmarks = set(ProjectBookmark.objects.filter(
                user=user,
                project__in=item_list,
            ).values_list('project_id', flat=True))
        else:
            bookmarks = set()

        result = {}
        for item in item_list:
            result[item] = {
                'is_bookmarked': item.id in bookmarks,
            }
        return result

    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        if features.has('projects:quotas', obj, actor=user):
            feature_list.append('quotas')
        if features.has('projects:global-events', obj, actor=user):
            feature_list.append('global-events')
        if features.has('projects:user-reports', obj, actor=user):
            feature_list.append('user-reports')

        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'isBookmarked': attrs['is_bookmarked'],
            'dateCreated': obj.date_added,
            'firstEvent': obj.first_event,
            'features': feature_list,
        }
