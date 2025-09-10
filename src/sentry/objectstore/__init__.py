from sentry.objectstore.service import Client, ClientBuilder

__all__ = ["Client", "ClientBuilder", "attachments"]

attachments = ClientBuilder("attachments")
