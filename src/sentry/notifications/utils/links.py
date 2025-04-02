"""
This file contains simple functions to generate links to Sentry pages

We can use this as a basepoint to build out our templating system in the future
"""


def create_link_to_workflow(organization_id: int, workflow_id: int) -> str:
    """
    Create a link to a workflow
    """
    return f"/organizations/{organization_id}/workflows/{workflow_id}/"
