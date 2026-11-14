from emmett55 import App
from emmett55.cache import Cache, RamCache
from emmett_prometheus import Prometheus
from emmett_sentry import Sentry

from .config import load_config
from .db import AsyncPG
from .resolver import Resolver

app = App(__name__)
load_config(app)

app.use_extension(Prometheus)
app.use_extension(Sentry)

db = app.use_extension(AsyncPG)
resolver = app.use_extension(Resolver)
cache = Cache(
    ram=RamCache(
        default_expire=app.config.cache.ttl,
        threshold=app.config.cache.max_items,
    )
)
