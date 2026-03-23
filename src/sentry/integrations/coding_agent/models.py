from pydantic import BaseModel

from sentry.seer.models import SeerRepoDefinition


class CodingAgentLaunchRequest(BaseModel):
    prompt: str
    repository: SeerRepoDefinition
    branch_name: str
    auto_create_pr: bool = False
