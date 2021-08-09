import requests
from django.conf import settings

from sentry.utils import json
from sentry.utils.redis import redis_clusters


class IpReputation:
    def __init__(self):
        self.cache = redis_clusters.get("default")

    def get(self, ip):
        result = self.get_from_cache(ip)

        if result:
            return result

        if settings.IP_REPUTATION_SERVICE == "fraudguard":
            result = self.get_from_fraudguard(ip)
            if result:
                self.set(ip, result)
                return result

        return None

    def get_key(self, ip):
        return "ip:rep:" + ip

    def get_from_cache(self, ip):
        result = self.cache.get(self.get_key(ip))
        if result:
            return json.loads(result)
        return None

    def get_from_fraudguard(self, ip):
        # https://docs.fraudguard.io/#fraudguard-io-api-docs
        r = requests.get("https://api.fraudguard.io/v2/ip/" + ip, auth=settings.IP_REPUTATION_AUTH)

        json_result = r.json()
        return {"risk_level": int(json_result["risk_level"]), "threat": json_result["threat"]}

    def set(self, ip, value):
        self.cache.set(self.get_key(ip), json.dumps(value), settings.IP_REPUTATION_TTL)
