from datetime import datetime

from confluent_kafka import Producer
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models.project import Project
from sentry.services.hybrid_cloud.user import user_service
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.dates import ensure_aware
from sentry.utils.kafka_config import get_kafka_producer_cluster_options


class BasicEventSerializer(serializers.Serializer):
    event_id = serializers.CharField()
    project_id = serializers.IntegerField()
    platform = serializers.CharField()
    tags = serializers.DictField()
    timestamp = serializers.DateTimeField()
    received = serializers.DateTimeField()


class IssueOccurrenceSerializer(serializers.Serializer):
    id = serializers.CharField()
    event_id = serializers.CharField()
    fingerprint = serializers.ListField()
    issue_title = serializers.CharField()
    subtitle = serializers.CharField()
    evidence_data = serializers.DictField()
    evidence_display = serializers.ListField()
    type = serializers.IntegerField()
    detection_time = serializers.DateTimeField()


@region_silo_endpoint
class IssueOccurrenceEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)
    private = True

    def post(self, request: Request) -> Response:
        """
        Write issue occurrence and event data to a Kafka topic
        ``````````````````````````````````````````````````````
        :auth: superuser required
        :pparam: string dummyEvent: pass 'True' to load a dummy event instead of providing one in the request
        :pparam: string dummyOccurrence: pass 'True' to load a dummy occurrence instead of providing one in the request
        """
        event = {}
        if request.query_params.get("dummyEvent") == "True":
            user = user_service.get_user(request.user.id)
            projects = Project.objects.get_for_user_ids({user.id})
            if not projects:
                return Response(
                    "Requesting user must belong to at least one project.",
                    status=status.HTTP_400_BAD_REQUEST,
                )
            event = {
                "event_id": "44f1419e73884cd2b45c79918f4b6dc4",
                "project_id": projects[0].id,
                "platform": "python",
                "tags": {"environment": "prod"},
                "timestamp": ensure_aware(datetime.now()),
                "received": ensure_aware(datetime.now()),
            }
        else:
            event = request.data.pop("event", None)

        if not event:
            return Response(
                "Must pass an event or query param of dummyEvent=True",
                status=status.HTTP_400_BAD_REQUEST,
            )

        occurrence = {}
        if request.query_params.get("dummyOccurrence") == "True":
            occurrence = {
                "id": "55f1419e73884cd2b45c79918f4b6dc5",
                "fingerprint": ["some-fingerprint"],
                "issue_title": "something bad happened",
                "subtitle": "it was bad",
                "resource_id": "1234",
                "evidence_data": {"Test": 123},
                "evidence_display": [
                    {
                        "name": "Attention",
                        "value": "Very important information!!!",
                        "important": True,
                    },
                    {
                        "name": "Evidence 2",
                        "value": "Not important",
                        "important": False,
                    },
                    {
                        "name": "Evidence 3",
                        "value": "Nobody cares about this",
                        "important": False,
                    },
                ],
                "type": GroupType.PROFILE_BLOCKED_THREAD.value,
                "detection_time": ensure_aware(datetime.now()),
                "event": event,
            }
        else:
            occurrence = request.data

        if not occurrence:
            return Response(
                "Must pass occurrence data or query param of dummyOccurrence=True",
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_serializer = BasicEventSerializer(data=event)
        if not event_serializer.is_valid():
            return Response(event_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        event = event_serializer.validated_data
        occurrence["event_id"] = str(event["event_id"])

        occurrence_serializer = IssueOccurrenceSerializer(data=occurrence)
        if not occurrence_serializer.is_valid():
            return Response(occurrence_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        occurrence = occurrence_serializer.validated_data
        data = {
            **occurrence,
            "event": event,
        }

        topic = settings.KAFKA_INGEST_OCCURRENCES
        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
        cluster_options = get_kafka_producer_cluster_options(cluster_name)
        producer = Producer(cluster_options)

        producer.produce(
            topic=topic,
            key=None,
            value=json.dumps(data, default=str),
        )
        producer.flush()

        return Response(status=status.HTTP_201_CREATED)
