from sentry import options as options_store
from sentry.objectstore.service import ClientBuilder

options = options_store.get("objectstore.config")
attachments = ClientBuilder(options["base_url"], "attachments", options)
