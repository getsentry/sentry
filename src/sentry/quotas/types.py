from typing import TypeAlias, Union

from sentry.models.organizationcontributors import OrganizationContributors
from sentry.monitors.models import Monitor
from sentry.workflow_engine.models import Detector

SeatObject: TypeAlias = Union[Monitor, Detector, OrganizationContributors]
