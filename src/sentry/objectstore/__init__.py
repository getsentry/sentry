from objectstore_client import Client, ClientBuilder, ClientError

__all__ = ["attachments", "Client", "ClientBuilder", "ClientError"]

attachments = ClientBuilder("attachments")
