import uuid
from datetime import datetime

from confluent_kafka import Producer
from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import Project
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options
from sentry.utils.samples import load_data


@region_silo_endpoint
class IssueOccurrenceEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def post(self, request: Request) -> Response:
        """
        Write issue occurrence and event data to a Kafka topic
        ``````````````````````````````````````````````````````
        :auth: superuser required
        :pparam: string dummyEvent: pass 'True' to load a dummy event instead of providing one in the request
        :pparam: string dummyOccurrence: pass 'True' to load a dummy occurrence instead of providing one in the request
        """
        if request.query_params.get("dummyOccurrence") == "True":
            dummy_occurrence = dict(load_data("generic-event-profiling"))
            dummy_occurrence["event"]["received"] = datetime.utcnow().isoformat()
            dummy_occurrence["event"]["timestamp"] = datetime.utcnow().isoformat()
            dummy_occurrence["detection_time"] = datetime.utcnow().timestamp()
            project_id = request.query_params.get("project_id")
            if project_id:
                project = Project.objects.get(id=project_id)
            else:
                user = user_service.get_user(request.user.id)
                projects = Project.objects.get_for_user_ids({user.id})
                if not projects:
                    return Response(
                        "Requesting user must belong to at least one project.",
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                project = projects[0]
            dummy_occurrence["id"] = uuid.uuid4().hex
            dummy_occurrence["event"]["event_id"] = uuid.uuid4().hex
            dummy_occurrence["project_id"] = project.id
            dummy_occurrence["event"]["project_id"] = project.id
            if "fingerprint" in request.query_params:
                dummy_occurrence["fingerprint"] = [request.query_params["fingerprint"]]
        else:
            dummy_occurrence = request.data

        if not dummy_occurrence:
            return Response(
                "Must pass an occurrence or query param of dummyOccurrence=True",
                status=status.HTTP_400_BAD_REQUEST,
            )

        topic = settings.KAFKA_INGEST_OCCURRENCES
        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
        cluster_options = get_kafka_producer_cluster_options(cluster_name)
        producer = Producer(cluster_options)

        producer.produce(
            topic=topic,
            key=None,
            value=json.dumps(dummy_occurrence, default=str),
        )
        producer.flush()

        return Response(status=status.HTTP_201_CREATED)
