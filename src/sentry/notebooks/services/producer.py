from __future__ import annotations
import abc
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any
from uuid import UUID
from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.notebooks.services.action_kinds.base import FollowUpCommand
    from sentry.notebooks.endpoints.serializers.action_request import (
        InvestigationActionRequestFollowUpResponse,
    )
    from sentry.notebooks.endpoints.serializers.investigation import (
        InvestigationOrchestrationSerializerResponse,
    )
