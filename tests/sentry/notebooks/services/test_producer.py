from unittest.mock import patch

import pytest

from sentry.investigations.notebook_producer import OrchestrationProducer
from sentry.investigations.services.action_kinds.update_detector import UpdateDetectorKind
from sentry.notebooks.services.action_kinds import ACTION_KINDS, register_action_kind
from sentry.notebooks.services.producer import PRODUCERS, register_producer


class OtherProducer(OrchestrationProducer):
    pass


class OtherKind(UpdateDetectorKind):
    pass


def test_registering_the_same_producer_type_again_is_allowed() -> None:
    with patch.dict(PRODUCERS, {}, clear=True):
        first = OrchestrationProducer()
        register_producer("manual", first)
        register_producer("manual", OrchestrationProducer())

        assert PRODUCERS["manual"] is first


def test_a_second_producer_type_for_a_source_type_is_rejected() -> None:
    with patch.dict(PRODUCERS, {}, clear=True):
        register_producer("manual", OrchestrationProducer())

        with pytest.raises(ValueError):
            register_producer("manual", OtherProducer())


def test_a_second_kind_type_for_a_kind_name_is_rejected() -> None:
    with patch.dict(ACTION_KINDS, {}, clear=True):
        register_action_kind(UpdateDetectorKind())
        register_action_kind(UpdateDetectorKind())

        with pytest.raises(ValueError):
            register_action_kind(OtherKind())
