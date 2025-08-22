import time

import requests


class ApolloClient(object):

    def __init__(self, uri, appid, ip=None):
        self.uri = uri
        self.appid = appid
        self.ip = self.get_ip() if ip is True else ip
        self.cluster = "default"
        self.namespace = "application"
        self.release = None
        self.setting = dict()
        self.last = 0
        self.rate = 1

    def get(self, key, cache=True):
        if not cache:
            self.pull()
        return self.setting.get(key)

    def pull(self):
        cur_time = int(time.time())
        if cur_time - self.last < self.rate:
            return
        self.last = int(time.time())
        url = "{uri}/configs/{appid}/{cluster}/{namespace}".format(**self.__dict__)
        payload = dict(releaseKey=self.release, ip=self.ip)
        response = requests.get(url, params=payload)
        if response.status_code != 200:
            return
        data = response.json()
        self.release = data.get("releaseKey")
        self.setting = data.get("configurations", {})
        return response

    @staticmethod
    def get_ip():
        import socket

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 53))
            ip = s.getsockname()[0]
        except:
            ip = socket.gethostbyname(socket.gethostname())
        finally:
            s.close()
        return ip

    @staticmethod
    def env():
        import os

        prefix = os.environ.get("ENV_PREFIX_APOLLO") or "APOLLO"
        uri = os.environ.get("%s_URI" % prefix) or "http://apollo-config.niwodai.net"
        appid = os.environ.get("%s_APPID" % prefix) or "sentry-archit-web"
        ip = os.environ.get("%s_IP" % prefix)
        cluster = os.environ.get("%s_CLUSTER" % prefix)
        namespace = os.environ.get("%s_NAMESPACE" % prefix)
        rate = os.environ.get("%s_RATE" % prefix)
        ip = True if ip == "1" else False if ip == "0" else ip
        print(
            f"uri: {uri}, appid: {appid}, ip: {ip}, cluster: {cluster}, namespace: {namespace}, rate: {rate}"
        )
        client = ApolloClient(uri, appid, ip=ip)
        if cluster:
            client.cluster = cluster
        if namespace:
            client.namespace = namespace
        if rate:
            client.rate = int(rate)
        return client
