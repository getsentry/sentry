class SlackRequestError(Exception):
    """
    Something was invalid about the request from Slack.

    Includes the status the endpoint should return, based on the error.
    """

    def __init__(self, status: int) -> None:
        self.status = status
