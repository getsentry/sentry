from emmett55 import App
from emmett55.serializers import Serializers
from emmett_prometheus import Prometheus
from emmett_sentry import Sentry

from .config import load_config
from .db import AsyncPG

app = App(__name__)
load_config(app)

app.use_extension(Prometheus)
app.use_extension(Sentry)

db = app.use_extension(AsyncPG)

json = Serializers.get_for("json")
