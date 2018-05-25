from __future__ import absolute_import
import re


def parse_raw_user_email(raw):
    # captures content between angle brackets
    match = re.search('(?<=<).*(?=>$)', raw)
    if match is None:
        return
    return match.group(0)


def parse_raw_user_name(raw):
    # captures content before angle bracket
    return raw.split('<')[0].strip()
