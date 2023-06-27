from .github import GithubRequestParser
from .gitlab import GitlabRequestParser
from .jira import JiraRequestParser
from .slack import SlackRequestParser

__all__ = (
    "GithubRequestParser",
    "JiraRequestParser",
    "SlackRequestParser",
    "GitlabRequestParser",
)
