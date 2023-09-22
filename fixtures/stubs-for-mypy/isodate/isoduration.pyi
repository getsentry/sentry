import datetime

from isodate.duration import Duration

def parse_duration(datestring: str) -> datetime.timedelta | Duration: ...
