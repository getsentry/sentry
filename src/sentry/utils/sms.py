from __future__ import absolute_import

import logging
import requests

from six.moves.urllib.parse import quote

from sentry import options


logger = logging.getLogger(__name__)


def sms_available():
    return bool(options.get('sms.twilio-account'))


def send_sms(body, to, from_=None):
    account = options.get('sms.twilio-account')
    if not account:
        raise RuntimeError('SMS backend is not configured.')
    if account[:2] != 'AC':
        account = 'AC' + account
    url = 'https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json' % \
        quote(account)
    rv = requests.post(url, auth=(account,
                             options.get('sms.twilio-token')), data={
        'To': to,
        'From': options.get('sms.twilio-number'),
        'Body': body,
    })
    if not rv.ok:
        logging.exception('Failed to send text message to %s: (%s) %s', to,
                          rv.status_code, rv.content)
        return False
    return True
