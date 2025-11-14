from typing import int
from pydantic import BaseModel

from sentry.seer.models import SeerRepoDefinition


class CodingAgentLaunchRequest(BaseModel):
    prompt: str
    repository: SeerRepoDefinition
    branch_name: str
