from __future__ import absolute_import

import logging

from collections import defaultdict
from uuid import uuid4

from django.db import IntegrityError, transaction

from rest_framework import serializers
from rest_framework.response import Response

from sentry import eventstream, features
from sentry.api.base import audit_logger
from sentry.api.fields import Actor, ActorField
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.models import (
    Commit, Group, GroupHash, GroupStatus, GroupTombstone, GroupSubscription,
    GroupSubscriptionReason, Release, Repository, TOMBSTONE_FIELDS_FROM_GROUP,
    Team, User, UserOption
)
from sentry.models.group import looks_like_short_id
from sentry.search.utils import InvalidQuery, parse_query
from sentry.signals import issue_deleted
from sentry.tasks.deletion import delete_groups as delete_groups_task
from sentry.utils.audit import create_audit_entry
from sentry.utils.cursors import Cursor

delete_logger = logging.getLogger('sentry.deletions.api')


class ValidationError(Exception):
    pass


def build_query_params_from_request(request, projects):
    query_kwargs = {
        'projects': projects,
        'sort_by': request.GET.get('sort', DEFAULT_SORT_OPTION),
    }

    limit = request.GET.get('limit')
    if limit:
        try:
            query_kwargs['limit'] = int(limit)
        except ValueError:
            raise ValidationError('invalid limit')

    # TODO: proper pagination support
    cursor = request.GET.get('cursor')
    if cursor:
        query_kwargs['cursor'] = Cursor.from_string(cursor)

    query = request.GET.get('query', 'is:unresolved').strip()
    if query:
        try:
            query_kwargs.update(parse_query(projects, query, request.user))
        except InvalidQuery as e:
            raise ValidationError(
                u'Your search query could not be parsed: {}'.format(
                    e.message)
            )

    return query_kwargs


def get_by_short_id(organization_id, is_short_id_lookup, query):
    if is_short_id_lookup == '1' and \
            looks_like_short_id(query):
        try:
            return Group.objects.by_qualified_short_id(
                organization_id, query
            )
        except Group.DoesNotExist:
            pass


STATUS_CHOICES = {
    'resolved': GroupStatus.RESOLVED,
    'unresolved': GroupStatus.UNRESOLVED,
    'ignored': GroupStatus.IGNORED,
    'resolvedInNextRelease': GroupStatus.UNRESOLVED,

    # TODO(dcramer): remove in 9.0
    'muted': GroupStatus.IGNORED,
}


class InCommitValidator(serializers.Serializer):
    commit = serializers.CharField(required=True)
    repository = serializers.CharField(required=True)

    def validate_repository(self, attrs, source):
        value = attrs[source]
        project = self.context['project']
        try:
            attrs[source] = Repository.objects.get(
                organization_id=project.organization_id,
                name=value,
            )
        except Repository.DoesNotExist:
            raise serializers.ValidationError(
                'Unable to find the given repository.'
            )
        return attrs

    def validate(self, attrs):
        attrs = super(InCommitValidator, self).validate(attrs)
        repository = attrs.get('repository')
        commit = attrs.get('commit')
        if not repository:
            raise serializers.ValidationError({
                'repository': ['Unable to find the given repository.'],
            })
        if not commit:
            raise serializers.ValidationError({
                'commit': ['Unable to find the given commit.'],
            })
        try:
            commit = Commit.objects.get(
                repository_id=repository.id,
                key=commit,
            )
        except Commit.DoesNotExist:
            raise serializers.ValidationError({
                'commit': ['Unable to find the given commit.'],
            })
        return commit


class StatusDetailsValidator(serializers.Serializer):
    inNextRelease = serializers.BooleanField()
    inRelease = serializers.CharField()
    inCommit = InCommitValidator(required=False)
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)

    def validate_inRelease(self, attrs, source):
        value = attrs[source]
        project = self.context['project']
        if value == 'latest':
            try:
                attrs[source] = Release.objects.filter(
                    projects=project,
                    organization_id=project.organization_id,
                ).extra(select={
                    'sort': 'COALESCE(date_released, date_added)',
                }).order_by('-sort')[0]
            except IndexError:
                raise serializers.ValidationError(
                    'No release data present in the system to form a basis for \'Next Release\''
                )
        else:
            try:
                attrs[source] = Release.objects.get(
                    projects=project,
                    organization_id=project.organization_id,
                    version=value,
                )
            except Release.DoesNotExist:
                raise serializers.ValidationError(
                    'Unable to find a release with the given version.'
                )
        return attrs

    def validate_inNextRelease(self, attrs, source):
        project = self.context['project']
        try:
            attrs[source] = Release.objects.filter(
                projects=project,
                organization_id=project.organization_id,
            ).extra(select={
                'sort': 'COALESCE(date_released, date_added)',
            }).order_by('-sort')[0]
        except IndexError:
            raise serializers.ValidationError(
                'No release data present in the system to form a basis for \'Next Release\''
            )
        return attrs


class GroupValidator(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()))
    statusDetails = StatusDetailsValidator()
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    merge = serializers.BooleanField()
    discard = serializers.BooleanField()
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    assignedTo = ActorField()

    # TODO(dcramer): remove in 9.0
    snoozeDuration = serializers.IntegerField()

    def validate_assignedTo(self, attrs, source):
        value = attrs[source]
        if value and value.type is User and not self.context['project'].member_set.filter(
                user_id=value.id).exists():
            raise serializers.ValidationError(
                'Cannot assign to non-team member')

        if value and value.type is Team and not self.context['project'].teams.filter(
                id=value.id).exists():
            raise serializers.ValidationError(
                'Cannot assign to a team without access to the project')

        return attrs

    def validate(self, attrs):
        attrs = super(GroupValidator, self).validate(attrs)
        if len(attrs) > 1 and 'discard' in attrs:
            raise serializers.ValidationError(
                'Other attributes cannot be updated when discarding')
        return attrs


def handle_discard(request, group_list, projects, user):
    for project in projects:
        if not features.has('projects:discard-groups', project, actor=user):
            return Response({'detail': ['You do not have that feature enabled']}, status=400)

    # grouped by project_id
    groups_to_delete = defaultdict(list)

    for group in group_list:
        with transaction.atomic():
            try:
                tombstone = GroupTombstone.objects.create(
                    previous_group_id=group.id,
                    actor_id=user.id if user else None,
                    **{name: getattr(group, name) for name in TOMBSTONE_FIELDS_FROM_GROUP}
                )
            except IntegrityError:
                # in this case, a tombstone has already been created
                # for a group, so no hash updates are necessary
                pass
            else:
                groups_to_delete[group.project_id].append(group)

                GroupHash.objects.filter(
                    group=group,
                ).update(
                    group=None,
                    group_tombstone_id=tombstone.id,
                )

    for project in projects:
        delete_groups(request, project, groups_to_delete.get(project.id), delete_type='discard')

    return Response(status=204)


def delete_groups(request, project, group_list, delete_type):
    if not group_list:
        return

    # deterministic sort for sanity, and for very large deletions we'll
    # delete the "smaller" groups first
    group_list.sort(key=lambda g: (g.times_seen, g.id))
    group_ids = [g.id for g in group_list]

    Group.objects.filter(
        id__in=group_ids,
    ).exclude(status__in=[
        GroupStatus.PENDING_DELETION,
        GroupStatus.DELETION_IN_PROGRESS,
    ]).update(status=GroupStatus.PENDING_DELETION)

    eventstream_state = eventstream.start_delete_groups(project.id, group_ids)
    transaction_id = uuid4().hex

    GroupHash.objects.filter(
        project_id=project.id,
        group__id__in=group_ids,
    ).delete()

    delete_groups_task.apply_async(
        kwargs={
            'object_ids': group_ids,
            'transaction_id': transaction_id,
            'eventstream_state': eventstream_state,
        },
        countdown=3600,
    )

    for group in group_list:
        create_audit_entry(
            request=request,
            transaction_id=transaction_id,
            logger=audit_logger,
            organization_id=project.organization_id,
            target_object=group.id,
        )

        delete_logger.info(
            'object.delete.queued',
            extra={
                'object_id': group.id,
                'transaction_id': transaction_id,
                'model': type(group).__name__,
            }
        )

        issue_deleted.send_robust(
            group=group,
            user=request.user,
            delete_type=delete_type,
            sender=delete_groups)


def self_subscribe_and_assign_issue(acting_user, group):
    # Used during issue resolution to assign to acting user
    # returns None if the user didn't elect to self assign on resolution
    # or the group is assigned already, otherwise returns Actor
    # representation of current user
    if acting_user:
        GroupSubscription.objects.subscribe(
            user=acting_user,
            group=group,
            reason=GroupSubscriptionReason.status_change,
        )
        self_assign_issue = UserOption.objects.get_value(
            user=acting_user, key='self_assign_issue', default='0'
        )
        if self_assign_issue == '1' and not group.assignee_set.exists():
            return Actor(type=User, id=acting_user.id)
