from sentry.models import Project

from rest_framework.permissions import BasePermission


class HasProjectPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'project'):
            obj = obj.project
        elif not isinstance(obj, Project):
            raise NotImplementedError('Object does not support permissions')

        return obj in Project.objects.get_for_user(request.user)