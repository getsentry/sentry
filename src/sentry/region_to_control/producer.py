from __future__ import annotations

import atexit
import dataclasses
from abc import abstractmethod
from typing import TYPE_CHECKING, Any, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from django.conf import settings

from sentry.region_to_control.messages import RegionToControlMessage, UserIpEvent
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation
from sentry.silo import SiloMode
from sentry.utils import json, kafka_config

if TYPE_CHECKING:
    from sentry.models import AuditLogEntry


class RegionToControlMessagingService(InterfaceWithLifecycle):
    @abstractmethod
    def write_region_to_control_message(self, payload: Any, sync: bool):
        pass


_empty_headers = list()


class KafkaBackedRegionToControlMessageService(RegionToControlMessagingService):
    _publisher: Optional[KafkaProducer]

    def __init__(self):
        self._publisher = None

    def close(self):
        if self._publisher is not None:
            self._publisher.close()

    def write_region_to_control_message(self, payload: Any, sync: bool):
        future = self.get_region_to_control_producer().produce(
            Topic(settings.KAFKA_REGION_TO_CONTROL),
            KafkaPayload(
                key=None,
                value=json.dumps(payload).encode("utf8"),
                headers=_empty_headers,
            ),
        )

        if not sync:
            return

        future.result(1.0)

    def get_region_to_control_producer(self) -> KafkaProducer:
        """
        Creates, if necessary, an arroyo.KafkaProducer client configured for region to control communication and returns
        it, caching it for future calls.  Installs an exit handler to close the worker thread processes.
        """
        if self._publisher is None:
            config = settings.KAFKA_TOPICS.get(settings.KAFKA_REGION_TO_CONTROL)
            self._publisher = KafkaProducer(
                kafka_config.get_kafka_producer_cluster_options(config["cluster"])
            )

            @atexit.register
            def exit_handler():
                self.close()

        return self._publisher


# Test default mock.
class MockRegionToControlMessageService(RegionToControlMessagingService):
    def __init__(self):
        from unittest.mock import Mock

        self.mock = Mock(spec_set=self)

    def write_region_to_control_message(self, payload: Any, sync: bool):
        self.mock.write_region_to_control_message(payload, sync)

    def close(self):
        self.mock.reset_mock()


# This service should only really exist in the region mode for now, but the delegator object is used for its
# convenience methods.
region_to_control_message_service: RegionToControlMessagingService = silo_mode_delegation(
    {SiloMode.REGION: KafkaBackedRegionToControlMessageService}
)


class AuditLogEntryService(InterfaceWithLifecycle):
    @abstractmethod
    def produce_audit_log_entry(self, entry: AuditLogEntry):
        pass


class RegionToControlAuditLogEntryService(AuditLogEntryService):
    region_to_control_messaging_service: RegionToControlMessagingService

    def __init__(
        self,
        region_to_control_messaging_service: RegionToControlMessagingService = region_to_control_message_service,
    ):
        self.region_to_control_messaging_service = region_to_control_messaging_service

    def produce_audit_log_entry(self, entry: AuditLogEntry):
        self.region_to_control_messaging_service.write_region_to_control_message(
            dataclasses.asdict(RegionToControlMessage(audit_log_event=entry.as_kafka_event())),
            sync=True,
        )

    def close(self):
        pass


class DatabaseBackedAuditLogEntryService(AuditLogEntryService):
    def produce_audit_log_entry(self, entry: AuditLogEntry):
        entry.save()

    def close(self):
        pass


audit_log_entry_service: AuditLogEntryService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedAuditLogEntryService,
        SiloMode.CONTROL: DatabaseBackedAuditLogEntryService,
        SiloMode.REGION: RegionToControlAuditLogEntryService,
    }
)


class UserIpService(InterfaceWithLifecycle):
    @abstractmethod
    def produce_user_ip(self, event: UserIpEvent):
        pass


class RegionToControlUserIpService(UserIpService):
    def close(self):
        pass

    region_to_control_messaging_service: RegionToControlMessagingService

    def __init__(
        self,
        region_to_control_messaging_service: RegionToControlMessagingService = region_to_control_message_service,
    ):
        self.region_to_control_messaging_service = region_to_control_messaging_service

    def produce_user_ip(self, event: UserIpEvent):
        self.region_to_control_messaging_service.write_region_to_control_message(
            dataclasses.asdict(RegionToControlMessage(user_ip_event=event)), sync=False
        )


class DatabaseBackedUserIpService(UserIpService):
    def close(self):
        pass

    def produce_user_ip(self, event: UserIpEvent):
        from sentry.models import UserIP

        UserIP.objects.create_or_update(
            user_id=event.user_id, ip_address=event.ip_address, values=dataclasses.asdict(event)
        )


user_ip_service: UserIpService = silo_mode_delegation(
    {
        SiloMode.REGION: RegionToControlUserIpService,
        SiloMode.MONOLITH: DatabaseBackedUserIpService,
        SiloMode.CONTROL: DatabaseBackedUserIpService,
    }
)
