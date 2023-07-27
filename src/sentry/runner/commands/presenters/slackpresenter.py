# import requests

from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter

# from sentry.utils import json


class SlackPresenter(OptionsPresenter):
    def error():
        pass

    def write():
        # build json_data and call send_to_webhook
        pass

    # def send_to_webhook(json_data):
    #     headers = {"Content-Type": "application/json"}
    #     try:
    #         # todo: change webhook url (pass in as k8s secret? eng pipes is public)
    #         #       send http post request to engpipes webhook
    #         #       figure out how to add env var k8s secrets?
    #         requests.post("url", data=json.dumps(json_data), headers=headers)
    #     except requests.exceptions.RequestException as e:
    #         print(f"{e}")
