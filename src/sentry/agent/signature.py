from __future__ import absolute_import

from sentry.models import Agent


def resolve(signature):
    # TODO(hazat): actually do right signature splitting
    if '#' in signature:
        agent_id, public_key = signature.split('#', 1)
        agent = Agent.objects.get(agent_id=agent_id)
    return agent
