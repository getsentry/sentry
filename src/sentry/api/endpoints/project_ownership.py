from __future__ import absolute_import

import six

from rest_framework import serializers
from rest_framework.response import Response
from django.utils import timezone

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectOwnership, resolve_actors

from sentry.ownership.grammar import parse_rules, dump_schema, ParseError


class ProjectOwnershipSerializer(serializers.Serializer):
    raw = serializers.CharField()
    fallthrough = serializers.BooleanField()

    def validate_raw(self, attrs, source):
        if not attrs[source].strip():
            return attrs
        try:
            rules = parse_rules(attrs[source])
        except ParseError as e:
            raise serializers.ValidationError(
                u'Parse error: %r (line %d, column %d)' % (
                    e.expr.name, e.line(), e.column()
                ))

        schema = dump_schema(rules)

        owners = {o for rule in rules for o in rule.owners}
        actors = resolve_actors(owners, self.context['ownership'].project_id)

        bad_actors = []
        for owner, actor in six.iteritems(actors):
            if actor is None:
                if owner.type == 'user':
                    bad_actors.append(owner.identifier)
                elif owner.type == 'team':
                    bad_actors.append(u'#{}'.format(owner.identifier))

        if bad_actors:
            raise serializers.ValidationError(
                u'Invalid rule owners: {}'.format(", ".join(bad_actors))
            )

        attrs['schema'] = schema
        return attrs

    def save(self):
        ownership = self.context['ownership']

        changed = False
        if 'raw' in self.object:
            raw = self.object['raw']
            if not raw.strip():
                raw = None

            if ownership.raw != raw:
                ownership.raw = raw
                ownership.schema = self.object.get('schema')
                changed = True

        if 'fallthrough' in self.object:
            fallthrough = self.object['fallthrough']
            if ownership.fallthrough != fallthrough:
                ownership.fallthrough = fallthrough
                changed = True

        if changed:
            now = timezone.now()
            if ownership.date_created is None:
                ownership.date_created = now
            ownership.last_updated = now
            ownership.save()

        return ownership


class ProjectOwnershipEndpoint(ProjectEndpoint):
    def get_ownership(self, project):
        try:
            return ProjectOwnership.objects.get(project=project)
        except ProjectOwnership.DoesNotExist:
            return ProjectOwnership(
                project=project,
                date_created=None,
                last_updated=None,
            )

    def get(self, request, project):
        """
        Retrieve a Project's Ownership configuration
        ````````````````````````````````````````````

        Return details on a project's ownership configuration.

        :auth: required
        """
        return Response(serialize(self.get_ownership(project), request.user))

    def put(self, request, project):
        """
        Update a Project's Ownership configuration
        ``````````````````````````````````````````

        Updates a project's ownership configuration settings. Only the
        attributes submitted are modified.

        :param string raw: Raw input for ownership configuration.
        :param boolean fallthrough: Indicate if there is no match on explicit rules,
                                    to fall through and make everyone an implicit owner.
        :auth: required
        """
        serializer = ProjectOwnershipSerializer(
            data=request.DATA,
            partial=True,
            context={'ownership': self.get_ownership(project)}
        )
        if serializer.is_valid():
            ownership = serializer.save()
            return Response(serialize(ownership, request.user))
        return Response(serializer.errors, status=400)
