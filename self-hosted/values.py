# 加到 helm chart 的 values.yml 文件中
import os

from sentry.utils.apollo_cipher.cipher import ApolloCipher
from sentry.utils.apollo_client.config import ApolloConfig

os.environ["APOLLO_APPID"] = "sentry-archit-web"
os.environ["APOLLO_URI"] = "http://apollo-config.niwodai.net"
# os.environ["APOLLO_URI"] = "http://apollo-config-test2.niwodai.net"
config = ApolloConfig(prefix="{APOLLO}")
config.init()


def get_pg_config():

    response = config.get("pg_config", apollo=False, env=False)
    if response:
        response = eval(response)
        apollo_cipher = ApolloCipher(os.environ["APOLLO_URI"])
        response["password"] = apollo_cipher.decrypt(response["password"])
        return response
    else:
        raise ValueError(response)


pg_config = get_pg_config()

# print("pg_config_conf", pg_config)

if pg_config:
    DATABASES = {
        "default": {
            "ENGINE": "sentry.db.postgres",
            "NAME": pg_config["database"],
            "USER": pg_config["user"],
            "PASSWORD": pg_config["password"],
            "HOST": pg_config["host"],
            "PORT": pg_config["port"],
        }
    }

# print("DATABASES_JY_CONF", DATABASES)
