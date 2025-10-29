from sentry.objectstore.service import Client, ClientBuilder

__all__ = ["attachments", "Client", "ClientBuilder"]

attachments = ClientBuilder("attachments")
