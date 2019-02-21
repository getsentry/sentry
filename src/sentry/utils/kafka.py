from __future__ import absolute_import

from django.conf import settings

from confluent_kafka import Producer


producer = Producer(settings.KAFKA_PRODUCER_OPTIONS)
