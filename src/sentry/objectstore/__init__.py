from sentry import options as options_store
from sentry.objectstore.service import Client, ClientBuilder

__all__ = ["attachments", "Client", "ClientBuilder"]

options = options_store.get("objectstore.config")
attachments = ClientBuilder(options["base_url"], "attachments", options)
