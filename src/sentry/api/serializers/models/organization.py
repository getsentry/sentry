from __future__ import absolute_import

from sentry.app import quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.models import (
    OnboardingTask,
    OnboardingTaskStatus,
    Organization,
    OrganizationAccessRequest,
    OrganizationOnboardingTask,
    OrganizationOption,
    Team,
    TeamStatus
)


@register(Organization)
class OrganizationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
        }

class OnboardingTasksSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'task': dict(OrganizationOnboardingTask.TASK_CHOICES).get(obj.task),
            'status': dict(OrganizationOnboardingTask.STATUS_CHOICES).get(obj.status),
            'user': obj.user.name,
            'date_completed': obj.date_completed,
        }

class DetailedOrganizationSerializer(OrganizationSerializer):
    def serialize(self, obj, attrs, user):
        from sentry import features
        from sentry.app import env
        from sentry.api.serializers.models.team import TeamWithProjectsSerializer

        team_list = list(Team.objects.filter(
            organization=obj,
            status=TeamStatus.VISIBLE,
        ))

        onboarding_tasks = list(OrganizationOnboardingTask.objects.filter(
            organization=obj,
        ))

        feature_list = []
        if features.has('organizations:sso', obj, actor=user):
            feature_list.append('sso')

        if getattr(obj.flags, 'allow_joinleave'):
            feature_list.append('open-membership')
        if not getattr(obj.flags, 'disable_shared_issues'):
            feature_list.append('shared-issues')

        context = super(DetailedOrganizationSerializer, self).serialize(
            obj, attrs, user)
        context['quota'] = {
            'maxRate': quotas.get_organization_quota(obj),
            'projectLimit': int(OrganizationOption.objects.get_value(
                organization=obj,
                key='sentry:project-rate-limit',
                default=100,
            )),
        }
        context['teams'] = serialize(
            team_list, user, TeamWithProjectsSerializer())
        if env.request:
            context['access'] = access.from_request(env.request, obj).scopes
        else:
            context['access'] = access.from_user(user, obj).scopes
        context['features'] = feature_list
        context['pendingAccessRequests'] = OrganizationAccessRequest.objects.filter(
            team__organization=obj,
        ).count()
        context['onboardingTasks'] = serialize(onboarding_tasks, user, OnboardingTasksSerializer())
        return context
