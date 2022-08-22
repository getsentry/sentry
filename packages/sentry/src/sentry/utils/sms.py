import logging
from urllib.parse import quote

import phonenumbers
import requests

from sentry import options

logger = logging.getLogger(__name__)


class InvalidPhoneNumber(Exception):
    def __init__(self, *args):
        if args:
            self.message = args[0]
        else:
            self.message = None

    def __str__(self):
        if self.message:
            return f"InvalidPhoneNumber: {self.message}"
        else:
            return "InvalidPhoneNumber"


def validate_phone_number(phone_number: str) -> bool:
    try:
        p = phonenumbers.parse(phone_number, "US")
    except phonenumbers.NumberParseException:
        return False

    return phonenumbers.is_valid_number(p) and phonenumbers.is_possible_number(p)


def phone_number_as_e164(num: str) -> str:
    """Validate and return the phone number in E.164 format.

    If no country code is provided, defaults to assuming the US, "+1".

    :param num: the number in string format can start with +43 (or other country codes)
    :type num: str

    :return: validated phone number in E.164 format
    :rtype: str
    """
    if validate_phone_number(num):
        p = phonenumbers.parse(num, "US")
        return phonenumbers.format_number(p, phonenumbers.PhoneNumberFormat.E164)
    else:
        raise InvalidPhoneNumber


def sms_available():
    return bool(options.get("sms.twilio-account"))


def send_sms(body, to, from_=None):
    account = options.get("sms.twilio-account")
    if not account:
        raise RuntimeError("SMS backend is not configured.")
    if account[:2] != "AC":
        account = "AC" + account
    url = "https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json" % quote(account)

    phone_number = phone_number_as_e164(to)

    rv = requests.post(
        url,
        auth=(account, options.get("sms.twilio-token")),
        data={"To": phone_number, "From": options.get("sms.twilio-number"), "Body": body},
    )
    if not rv.ok:
        logging.exception(
            "Failed to send text message to %s: (%s) %s", phone_number, rv.status_code, rv.content
        )
        return False
    return True
