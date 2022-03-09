import calendar

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import Organization, Project, PromptsActivity
from sentry.utils.compat import zip
from sentry.utils.prompts import prompt_config

VALID_STATUSES = frozenset(("snoozed", "dismissed"))


# Endpoint to retrieve multiple PromptsActivity at once
class PromptsActivitySerializer(serializers.Serializer):
    feature = serializers.CharField(required=True)
    status = serializers.ChoiceField(choices=zip(VALID_STATUSES, VALID_STATUSES), required=True)

    def validate_feature(self, value):
        if value is None:
            raise serializers.ValidationError("Must specify feature name")
        if not prompt_config.has(value):
            raise serializers.ValidationError("Not a valid feature prompt")
        return value


class PromptsActivityEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Return feature prompt status if dismissed or in snoozed period"""

        features = request.GET.getlist("feature")
        if len(features) == 0:
            return Response({"details": "No feature specified"}, status=400)

        conditions = None
        for feature in features:
            if not prompt_config.has(feature):
                return Response({"detail": "Invalid feature name " + feature}, status=400)

            required_fields = prompt_config.required_fields(feature)
            for field in required_fields:
                if field not in request.GET:
                    return Response({"detail": 'Missing required field "%s"' % field}, status=400)
            filters = {k: request.GET.get(k) for k in required_fields}
            condition = Q(feature=feature, **filters)
            conditions = condition if conditions is None else (conditions | condition)

        result = PromptsActivity.objects.filter(conditions, user=request.user)
        featuredata = {k.feature: k.data for k in result}
        if len(features) == 1:
            result = result.first()
            data = None if result is None else result.data
            return Response({"data": data, "features": featuredata})
        else:
            return Response({"features": featuredata})

    def put(self, request: Request):
        serializer = PromptsActivitySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data
        feature = serialized["feature"]
        status = serialized["status"]

        required_fields = prompt_config.required_fields(feature)
        fields = {k: request.data.get(k) for k in required_fields}

        if any(elem is None for elem in fields.values()):
            return Response({"detail": "Missing required field"}, status=400)

        # if project_id or organization_id in required fields make sure they exist
        # if NOT in required fields, insert dummy value so dups aren't recorded
        if "project_id" in required_fields:
            if not Project.objects.filter(id=fields["project_id"]).exists():
                return Response({"detail": "Project no longer exists"}, status=400)
        else:
            fields["project_id"] = 0

        if "organization_id" in required_fields:
            if not Organization.objects.filter(id=fields["organization_id"]).exists():
                return Response({"detail": "Organization no longer exists"}, status=400)
        else:
            fields["organization_id"] = 0

        data = {}
        now = calendar.timegm(timezone.now().utctimetuple())
        if status == "snoozed":
            data["snoozed_ts"] = now
        elif status == "dismissed":
            data["dismissed_ts"] = now

        try:
            with transaction.atomic():
                PromptsActivity.objects.update_or_create(
                    feature=feature,
                    user=request.user,
                    defaults={"data": data, **fields},
                )
        except IntegrityError:
            pass
        return HttpResponse(status=201)
