from urllib.parse import urlsplit, urlunsplit

from sentry.utils.safe import get_path
from sentry.utils.strings import strip

from .base import BaseEvent

LOCAL = "'self'"


def _normalize_uri(value):
    """
    Normalizes a URI.

    If the value is ``LOCAL``, returns ``LOCAL``. Otherwise, splits on the first colon (:) and returns the hostname if it's not empty
    or :param scheme::// otherwise. If there is no colon in the value, then just return :param scheme::// instead of an empty hostname.
    """
    if value in ("", LOCAL, LOCAL.strip("'")):
        return LOCAL

    # A lot of these values get reported as literally
    # just the scheme. So a value like 'data' or 'blob', which
    # are valid schemes, just not a uri. So we want to
    # normalize it into a uri.
    if ":" not in value:
        scheme, hostname = value, ""
    else:
        scheme, hostname = urlsplit(value)[:2]
        if scheme in ("http", "https"):
            return hostname
    return urlunsplit((scheme, hostname, "", None, None))


class SecurityEvent(BaseEvent):
    def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
        """
        Extracts the metadata from a :class:`SecurityEvent` object.

        Parameters:
            data (dict): The JSON data returned by the API.

            Returns:
        dict: A dictionary containing all of the relevant extracted metadata.  In this case, it will be an empty dictionary since there is no additional
        metadata to extract beyond what was already extracted in SecurityEvent's `extract_metadata()`.  However, if you were extracting information from a
        request that contained more than one piece of information, then you would return a dictionary with keys for each piece of information and values for
        those pieces of information as appropriate.  For example, if we were extracting hostnames from requests that contained certificates and wanted to
        include them in our analysis then we could do something like this:

                    >>> def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
                    ...     # Extract
        everything else as normal...
                    ...     metadata = SecurityEvent.extract_metadata(self) # Get everything else... We'll cover how to get
        certificate info later! :)   This is just an example! Don't do it like this! :)   Just want to show you can access other things besides just
        "expectstaple" here... ;) ;) ;) ;
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `/security-events`.
            For example, this is a valid response for an HTTP request to `/security-events?from=1559347200&to=1559437500`, where
        1559347200 is unix timestamp of 1559569600 and 1559437500 is unix timestamp of 1560126000.

            .. code-block :: python

                {'expectstaple':
        {'date_time': '2019-06-25T16:45Z', 'hostname': 'example.com', 'port': 443, 'response': [{'advisory': None,
        ...}]}, ...}

            Here we have only one security event in this dict but there could be more than one if you use `from=0&to=1560126000`. This function
        will extract all events that match the given criteria (in this case only 1). If no security events are found then it returns an empty list (
        """
        # Relay normalizes the message for security reports into the log entry
        # field, so we grab the message from there.
        # (https://github.com/getsentry/relay/pull/558)
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )
        return {"message": message}

    def get_title(self, metadata):
        # Due to a regression (https://github.com/getsentry/sentry/pull/19794)
        # some events did not have message persisted but title. Because of this
        # the title code has to take these into account.
        return metadata.get("message") or metadata.get("title") or "<untitled>"

    def get_location(self, metadata):
        # Try to get location by preferring URI over origin.  This covers
        # all the cases below where CSP sets URI and others set origin.
        return metadata.get("uri") or metadata.get("origin")


class CspEvent(SecurityEvent):
    key = "csp"

    def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
        """
        Extracts the metadata from a :class:`SecurityEvent` object.

        Parameters:
            data (dict): The JSON data returned by the API.

            Returns:
        dict: A dictionary containing all of the relevant extracted metadata.  In this case, it will be an empty dictionary since there is no additional
        metadata to extract beyond what was already extracted in SecurityEvent's `extract_metadata()`.  However, if you were extracting information from a
        request that contained more than one piece of information, then you would return a dictionary with keys for each piece of information and values for
        those pieces of information as appropriate.  For example, if we were extracting hostnames from requests that contained certificates and wanted to
        include them in our analysis then we could do something like this:

                    >>> def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
                    ...     # Extract
        everything else as normal...
                    ...     metadata = SecurityEvent.extract_metadata(self) # Get everything else... We'll cover how to get
        certificate info later! :)   This is just an example! Don't do it like this! :)   Just want to show you can access other things besides just
        "expectstaple" here... ;) ;) ;) ;
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `/security-events`.
            For example, this is a valid response for an HTTP request to `/security-events?from=1559347200&to=1559437500`, where
        1559347200 is unix timestamp of 1559569600 and 1559437500 is unix timestamp of 1560126000.

            .. code-block :: python

                {'expectstaple':
        {'date_time': '2019-06-25T16:45Z', 'hostname': 'example.com', 'port': 443, 'response': [{'advisory': None,
        ...}]}, ...}

            Here we have only one security event in this dict but there could be more than one if you use `from=0&to=1560126000`. This function
        will extract all events that match the given criteria (in this case only 1). If no security events are found then it returns an empty list (
        """
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["uri"] = _normalize_uri(data["csp"].get("blocked_uri") or "")
        metadata["directive"] = data["csp"].get("effective_directive")
        return metadata


class HpkpEvent(SecurityEvent):
    key = "hpkp"

    def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
        """
        Extracts the metadata from a :class:`SecurityEvent` object.

        Parameters:
            data (dict): The JSON data returned by the API.

            Returns:
        dict: A dictionary containing all of the relevant extracted metadata.  In this case, it will be an empty dictionary since there is no additional
        metadata to extract beyond what was already extracted in SecurityEvent's `extract_metadata()`.  However, if you were extracting information from a
        request that contained more than one piece of information, then you would return a dictionary with keys for each piece of information and values for
        those pieces of information as appropriate.  For example, if we were extracting hostnames from requests that contained certificates and wanted to
        include them in our analysis then we could do something like this:

                    >>> def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
                    ...     # Extract
        everything else as normal...
                    ...     metadata = SecurityEvent.extract_metadata(self) # Get everything else... We'll cover how to get
        certificate info later! :)   This is just an example! Don't do it like this! :)   Just want to show you can access other things besides just
        "expectstaple" here... ;) ;) ;) ;
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `/security-events`.
            For example, this is a valid response for an HTTP request to `/security-events?from=1559347200&to=1559437500`, where
        1559347200 is unix timestamp of 1559569600 and 1559437500 is unix timestamp of 1560126000.

            .. code-block :: python

                {'expectstaple':
        {'date_time': '2019-06-25T16:45Z', 'hostname': 'example.com', 'port': 443, 'response': [{'advisory': None,
        ...}]}, ...}

            Here we have only one security event in this dict but there could be more than one if you use `from=0&to=1560126000`. This function
        will extract all events that match the given criteria (in this case only 1). If no security events are found then it returns an empty list (
        """
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["origin"] = data["hpkp"].get("hostname")
        return metadata


class ExpectCTEvent(SecurityEvent):
    key = "expectct"

    def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
        """
        Extracts the metadata from a :class:`SecurityEvent` object.

        Parameters:
            data (dict): The JSON data returned by the API.

            Returns:
        dict: A dictionary containing all of the relevant extracted metadata.  In this case, it will be an empty dictionary since there is no additional
        metadata to extract beyond what was already extracted in SecurityEvent's `extract_metadata()`.  However, if you were extracting information from a
        request that contained more than one piece of information, then you would return a dictionary with keys for each piece of information and values for
        those pieces of information as appropriate.  For example, if we were extracting hostnames from requests that contained certificates and wanted to
        include them in our analysis then we could do something like this:

                    >>> def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
                    ...     # Extract
        everything else as normal...
                    ...     metadata = SecurityEvent.extract_metadata(self) # Get everything else... We'll cover how to get
        certificate info later! :)   This is just an example! Don't do it like this! :)   Just want to show you can access other things besides just
        "expectstaple" here... ;) ;) ;) ;
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `/security-events`.
            For example, this is a valid response for an HTTP request to `/security-events?from=1559347200&to=1559437500`, where
        1559347200 is unix timestamp of 1559569600 and 1559437500 is unix timestamp of 1560126000.

            .. code-block :: python

                {'expectstaple':
        {'date_time': '2019-06-25T16:45Z', 'hostname': 'example.com', 'port': 443, 'response': [{'advisory': None,
        ...}]}, ...}

            Here we have only one security event in this dict but there could be more than one if you use `from=0&to=1560126000`. This function
        will extract all events that match the given criteria (in this case only 1). If no security events are found then it returns an empty list (
        """
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["origin"] = data["expectct"].get("hostname")
        return metadata


class ExpectStapleEvent(SecurityEvent):
    key = "expectstaple"

    def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
        """
        Extracts the metadata from a :class:`SecurityEvent` object.

        Parameters:
            data (dict): The JSON data returned by the API.

            Returns:
        dict: A dictionary containing all of the relevant extracted metadata.  In this case, it will be an empty dictionary since there is no additional
        metadata to extract beyond what was already extracted in SecurityEvent's `extract_metadata()`.  However, if you were extracting information from a
        request that contained more than one piece of information, then you would return a dictionary with keys for each piece of information and values for
        those pieces of information as appropriate.  For example, if we were extracting hostnames from requests that contained certificates and wanted to
        include them in our analysis then we could do something like this:

                    >>> def extract_metadata(self, data):
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param dict data: A JSON-serializable dictionary containing
        the event data as returned by Certbot's client command.
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `OpenSSL's OCSP stapling feature <http://man7.org/linux/man-pages/man1/ocsp.1.html>`_.
            For example, this is what you get when running `openssl
        s_client -status -connect localhost:5002 < /dev/null | openssl ocsp -text > response && cat response`.

            .. code-block :: python
        {'expectstaple': {'responseStatus': 'successful', 'responses': [{'certID': {'hashAlgorithm': 'sha256',
                    'issuerNameHash':
        '0b5ea937168d847e173955de3f36a36538fd067e4d49b26db9f22cd99c851179',  # noQA=ignore= E501 line too long
                    ...}, ...], ...}}

            The
        ``responses`` key contains a list
        """
        """
        Extracts the hostname from a :class:`dict` of data produced by the
        :class:`.ExpectStaplePlugin`.
        """
                    ...     # Extract
        everything else as normal...
                    ...     metadata = SecurityEvent.extract_metadata(self) # Get everything else... We'll cover how to get
        certificate info later! :)   This is just an example! Don't do it like this! :)   Just want to show you can access other things besides just
        "expectstaple" here... ;) ;) ;) ;
        """
        """
        Extracts the hostname from a :class:`~certbot_integration_tests.vectors.SecurityEvent`.

        :param data: A :class:`dict` with the JSON data returned by
        `/security-events`.
            For example, this is a valid response for an HTTP request to `/security-events?from=1559347200&to=1559437500`, where
        1559347200 is unix timestamp of 1559569600 and 1559437500 is unix timestamp of 1560126000.

            .. code-block :: python

                {'expectstaple':
        {'date_time': '2019-06-25T16:45Z', 'hostname': 'example.com', 'port': 443, 'response': [{'advisory': None,
        ...}]}, ...}

            Here we have only one security event in this dict but there could be more than one if you use `from=0&to=1560126000`. This function
        will extract all events that match the given criteria (in this case only 1). If no security events are found then it returns an empty list (
        """
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["origin"] = data["expectstaple"].get("hostname")
        return metadata
