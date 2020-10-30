from __future__ import absolute_import

import six

from rest_framework import serializers
from rest_framework.response import Response
from django.utils import timezone

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectOwnership, resolve_actors
from sentry.signals import ownership_rule_created

from sentry.ownership.grammar import parse_rules, dump_schema, ParseError


class ProjectOwnershipSerializer(serializers.Serializer):
    raw = serializers.CharField(allow_blank=True)
    fallthrough = serializers.BooleanField()
    autoAssignment = serializers.BooleanField()

    def validate(self, attrs):
        if not attrs.get("raw", "").strip():
            return attrs
        try:
            rules = parse_rules(attrs["raw"])
        except ParseError as e:
            raise serializers.ValidationError(
                {
                    "raw": u"Parse error: %r (line %d, column %d)"
                    % (e.expr.name, e.line(), e.column())
                }
            )

        schema = dump_schema(rules)

        owners = {o for rule in rules for o in rule.owners}
        actors = resolve_actors(owners, self.context["ownership"].project_id)

        bad_actors = []
        for owner, actor in six.iteritems(actors):
            if actor is None:
                if owner.type == "user":
                    bad_actors.append(owner.identifier)
                elif owner.type == "team":
                    bad_actors.append(u"#{}".format(owner.identifier))

        if bad_actors:
            bad_actors.sort()
            raise serializers.ValidationError(
                {"raw": u"Invalid rule owners: {}".format(", ".join(bad_actors))}
            )

        attrs["schema"] = schema
        return attrs

    def save(self):
        ownership = self.context["ownership"]

        changed = False
        if "raw" in self.validated_data:
            raw = self.validated_data["raw"]
            if not raw.strip():
                raw = None

            if ownership.raw != raw:
                ownership.raw = raw
                ownership.schema = self.validated_data.get("schema")
                changed = True

        if "fallthrough" in self.validated_data:
            fallthrough = self.validated_data["fallthrough"]
            if ownership.fallthrough != fallthrough:
                ownership.fallthrough = fallthrough
                changed = True

        changed = self.__modify_auto_assignment(ownership) or changed

        if changed:
            now = timezone.now()
            if ownership.date_created is None:
                ownership.date_created = now
            ownership.last_updated = now
            ownership.save()

        return ownership

    def __modify_auto_assignment(self, ownership):
        auto_assignment = self.validated_data.get("autoAssignment")

        if auto_assignment is None:
            return False

        changed = ownership.auto_assignment != auto_assignment

        if changed:
            ownership.auto_assignment = auto_assignment

        return changed


class ProjectOwnershipEndpoint(ProjectEndpoint):
    def get_ownership(self, project):
        try:
            return ProjectOwnership.objects.get(project=project)
        except ProjectOwnership.DoesNotExist:
            return ProjectOwnership(project=project, date_created=None, last_updated=None)

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
            data=request.data, partial=True, context={"ownership": self.get_ownership(project)}
        )
        if serializer.is_valid():
            ownership = serializer.save()
            ownership_rule_created.send_robust(project=project, sender=self.__class__)
            return Response(serialize(ownership, request.user))
        return Response(serializer.errors, status=400)
