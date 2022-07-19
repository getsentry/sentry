from google.cloud.pubsub_v1 import PublisherClient


def function_pubsub_name(funcId):
    return "projects/sentry-functions/topics/fn-" + funcId


def create_function_pubsub_topic(funcId):
    publisher = PublisherClient()
    publisher.create_topic(name=function_pubsub_name(funcId))
