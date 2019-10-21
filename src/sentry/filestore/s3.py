"""
sentry.filestore.s3
~~~~~~~~~~~~~~~~~~~

Slightly modified django-storages based s3boto3 backend.

Copyright (c) 2016 Sentry
Copyright (c) 2008-2013, see https://github.com/jschneier/django-storages/blob/66c9d6b/AUTHORS.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    1. Redistributions of source code must retain the above copyright notice,
       this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
       notice, this list of conditions and the following disclaimer in the
       documentation and/or other materials provided with the distribution.

    3. Neither the name of django-storages nor the names of its contributors
       may be used to endorse or promote products derived from this software
       without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
"""

from __future__ import absolute_import

import os
import posixpath
import mimetypes
import threading
from gzip import GzipFile

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, SuspiciousOperation
from django.core.files.base import File
from django.core.files.storage import Storage
from django.utils.encoding import force_text, smart_str, filepath_to_uri, force_bytes
from django.utils.six.moves.urllib import parse as urlparse
from django.utils.six import BytesIO
from django.utils.timezone import localtime

from boto3.session import Session
from botocore.client import Config
from botocore.exceptions import ClientError

from sentry.utils import metrics

_thread_local_connection = threading.local()


def _get_thread_local_session():
    try:
        return _thread_local_connection.session
    except AttributeError:
        rv = _thread_local_connection.session = Session()
        return rv


def resource(*args, **kwargs):
    return _get_thread_local_session().resource(*args, **kwargs)


def safe_join(base, *paths):
    """
    A version of django.utils._os.safe_join for S3 paths.

    Joins one or more path components to the base path component
    intelligently. Returns a normalized version of the final path.

    The final path must be located inside of the base path component
    (otherwise a ValueError is raised).

    Paths outside the base path indicate a possible security
    sensitive operation.
    """
    base_path = force_text(base)
    base_path = base_path.rstrip("/")
    paths = [force_text(p) for p in paths]

    final_path = base_path
    for path in paths:
        final_path = urlparse.urljoin(final_path.rstrip("/") + "/", path)

    # Ensure final_path starts with base_path and that the next character after
    # the final path is '/' (or nothing, in which case final_path must be
    # equal to base_path).
    base_path_len = len(base_path)
    if not final_path.startswith(base_path) or final_path[
        base_path_len : base_path_len + 1
    ] not in ("", "/"):
        raise ValueError("the joined path is located outside of the base path" " component")

    return final_path.lstrip("/")


class S3Boto3StorageFile(File):
    """
    The default file object used by the S3Boto3Storage backend.

    This file implements file streaming using boto's multipart
    uploading functionality. The file can be opened in read or
    write mode.

    This class extends Django's File class. However, the contained
    data is only the data contained in the current buffer. So you
    should not access the contained file object directly. You should
    access the data via this class.

    Warning: This file *must* be closed using the close() method in
    order to properly write the file to S3. Be sure to close the file
    in your application.
    """

    # TODO: Read/Write (rw) mode may be a bit undefined at the moment. Needs testing.
    # TODO: When Django drops support for Python 2.5, rewrite to use the
    #       BufferedIO streams in the Python 2.6 io module.
    buffer_size = 5242880

    def __init__(self, name, mode, storage, buffer_size=None):
        self._storage = storage
        self.name = name[len(self._storage.location) :].lstrip("/")
        self._mode = mode
        self.obj = storage.bucket.Object(storage._encode_name(name))
        # NOTE(mattrobenolt): This is an explicit deviation from
        # django-storages. This adds an extra HEAD request before
        # every GET. This effectively doubles the time it takes for
        # every chunk in our filestore. We explicitly are opting
        # out of this behavior to avoid this overhead.
        #
        # if 'w' not in mode:
        #     # Force early RAII-style exception if object does not exist
        #     self.obj.load()
        self._is_dirty = False
        self._file = None
        self._multipart = None
        # 5 MB is the minimum part size (if there is more than one part).
        # Amazon allows up to 10,000 parts.  The default supports uploads
        # up to roughly 50 GB.  Increase the part size to accommodate
        # for files larger than this.
        if buffer_size is not None:
            self.buffer_size = buffer_size
        self._write_counter = 0

    @property
    def size(self):
        return self.obj.content_length

    def _get_file(self):
        if self._file is None:
            with metrics.timer("filestore.read", instance="s3"):
                self._file = BytesIO()
                if "r" in self._mode:
                    self._is_dirty = False
                    self._file.write(self.obj.get()["Body"].read())
                    self._file.seek(0)
                if self._storage.gzip and self.obj.content_encoding == "gzip":
                    self._file = GzipFile(mode=self._mode, fileobj=self._file, mtime=0.0)
        return self._file

    def _set_file(self, value):
        self._file = value

    file = property(_get_file, _set_file)

    def read(self, *args, **kwargs):
        if "r" not in self._mode:
            raise AttributeError("File was not opened in read mode.")
        return super(S3Boto3StorageFile, self).read(*args, **kwargs)

    def write(self, content):
        if "w" not in self._mode:
            raise AttributeError("File was not opened in write mode.")
        self._is_dirty = True
        if self._multipart is None:
            parameters = self._storage.object_parameters.copy()
            parameters["ACL"] = self._storage.default_acl
            parameters["ContentType"] = (
                mimetypes.guess_type(self.obj.key)[0] or self._storage.default_content_type
            )
            if self._storage.reduced_redundancy:
                parameters["StorageClass"] = "REDUCED_REDUNDANCY"
            if self._storage.encryption:
                parameters["ServerSideEncryption"] = "AES256"
            self._multipart = self.obj.initiate_multipart_upload(**parameters)
        if self.buffer_size <= self._buffer_file_size:
            self._flush_write_buffer()
        return super(S3Boto3StorageFile, self).write(force_bytes(content))

    @property
    def _buffer_file_size(self):
        pos = self.file.tell()
        self.file.seek(0, os.SEEK_END)
        length = self.file.tell()
        self.file.seek(pos)
        return length

    def _flush_write_buffer(self):
        """
        Flushes the write buffer.
        """
        if self._buffer_file_size:
            self._write_counter += 1
            self.file.seek(0)
            part = self._multipart.Part(self._write_counter)
            part.upload(Body=self.file.read())

    def close(self):
        if self._is_dirty:
            self._flush_write_buffer()
            # TODO: Possibly cache the part ids as they're being uploaded
            # instead of requesting parts from server. For now, emulating
            # s3boto's behavior.
            parts = [
                {"ETag": part.e_tag, "PartNumber": part.part_number}
                for part in self._multipart.parts.all()
            ]
            self._multipart.complete(MultipartUpload={"Parts": parts})
        else:
            if self._multipart is not None:
                self._multipart.abort()
        if self._file is not None:
            self._file.close()
            self._file = None


class S3Boto3Storage(Storage):
    """
    Amazon Simple Storage Service using Boto3

    This storage backend supports opening files in read or write
    mode and supports streaming(buffering) data in chunks to S3
    when writing.
    """

    # XXX: note that this file reads entirely into memory before the first
    # read happens.  This means that it should only be used for small
    # files (eg: see how sentry.models.file works with it through the
    # ChunkedFileBlobIndexWrapper.
    connection_class = staticmethod(resource)
    connection_service_name = "s3"
    default_content_type = "application/octet-stream"
    connection_response_error = ClientError
    file_class = S3Boto3StorageFile
    # If config provided in init, signature_version and addressing_style settings/args are ignored.
    config = None

    # used for looking up the access and secret key from env vars
    access_key_names = ["AWS_S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]
    secret_key_names = ["AWS_S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]

    access_key = None
    secret_key = None
    file_overwrite = True
    object_parameters = {}
    bucket_name = None
    auto_create_bucket = False
    default_acl = "public-read"
    bucket_acl = default_acl
    querystring_auth = True
    querystring_expire = 3600
    signature_version = None
    reduced_redundancy = False
    location = ""
    encryption = False
    custom_domain = None
    addressing_style = None
    secure_urls = True
    file_name_charset = "utf-8"
    gzip = False
    preload_metadata = False
    gzip_content_types = (
        "text/css",
        "text/javascript",
        "application/javascript",
        "application/x-javascript",
        "image/svg+xml",
    )
    url_protocol = "https:"
    endpoint_url = None
    region_name = None
    use_ssl = True

    def __init__(self, acl=None, bucket=None, **settings):
        # check if some of the settings we've provided as class attributes
        # need to be overwritten with values passed in here
        for name, value in settings.items():
            if hasattr(self, name):
                setattr(self, name, value)

        # For backward-compatibility of old differing parameter names
        if acl is not None:
            self.default_acl = acl
        if bucket is not None:
            self.bucket_name = bucket

        self.location = (self.location or "").lstrip("/")
        # Backward-compatibility: given the anteriority of the SECURE_URL setting
        # we fall back to https if specified in order to avoid the construction
        # of unsecure urls.
        if self.secure_urls:
            self.url_protocol = "https:"

        self._entries = {}
        self._bucket = None
        self._connection = None

        if not self.access_key and not self.secret_key:
            self.access_key, self.secret_key = self._get_access_keys()

        if not self.config:
            self.config = Config(
                s3={"addressing_style": self.addressing_style},
                signature_version=self.signature_version,
            )

    @property
    def connection(self):
        # TODO: Support host, port like in s3boto
        # Note that proxies are handled by environment variables that the underlying
        # urllib/requests libraries read. See https://github.com/boto/boto3/issues/338
        # and http://docs.python-requests.org/en/latest/user/advanced/#proxies
        if self._connection is None:

            # If this is running on an ec2 instance, allow boto to connect using an IAM role
            # instead of explicitly provided an access key and secret
            # http://boto3.readthedocs.io/en/latest/guide/configuration.html#iam-role
            kwargs = {}
            if self.access_key and self.secret_key:
                kwargs["aws_access_key_id"] = self.access_key
                kwargs["aws_secret_access_key"] = self.secret_key

            self._connection = self.connection_class(
                self.connection_service_name,
                region_name=self.region_name,
                use_ssl=self.use_ssl,
                endpoint_url=self.endpoint_url,
                config=self.config,
                **kwargs
            )
        return self._connection

    @property
    def bucket(self):
        """
        Get the current bucket. If there is no current bucket object
        create it.
        """
        if self._bucket is None:
            self._bucket = self._get_or_create_bucket(self.bucket_name)
        return self._bucket

    @property
    def entries(self):
        """
        Get the locally cached files for the bucket.
        """
        if self.preload_metadata and not self._entries:
            self._entries = dict(
                (self._decode_name(entry.key), entry)
                for entry in self.bucket.objects.filter(Prefix=self.location)
            )
        return self._entries

    def _get_access_keys(self):
        """
        Gets the access keys to use when accessing S3. If none
        are provided to the class in the constructor or in the
        settings then get them from the environment variables.
        """

        def lookup_env(names):
            for name in names:
                value = os.environ.get(name)
                if value:
                    return value

        access_key = self.access_key or lookup_env(self.access_key_names)
        secret_key = self.secret_key or lookup_env(self.secret_key_names)
        return access_key, secret_key

    def _get_or_create_bucket(self, name):
        """
        Retrieves a bucket if it exists, otherwise creates it.
        """
        bucket = self.connection.Bucket(name)
        if self.auto_create_bucket:
            try:
                # Directly call head_bucket instead of bucket.load() because head_bucket()
                # fails on wrong region, while bucket.load() does not.
                bucket.meta.client.head_bucket(Bucket=name)
            except self.connection_response_error as err:
                if err.response["ResponseMetadata"]["HTTPStatusCode"] == 301:
                    raise ImproperlyConfigured(
                        "Bucket %s exists, but in a different "
                        "region than we are connecting to. Set "
                        "the region to connect to by setting "
                        "AWS_S3_REGION_NAME to the correct region." % name
                    )
                    # Notes: When using the us-east-1 Standard endpoint, you can create
                    # buckets in other regions. The same is not true when hitting region specific
                    # endpoints. However, when you create the bucket not in the same region, the
                    # connection will fail all future requests to the Bucket after the creation
                    # (301 Moved Permanently).
                    #
                    # For simplicity, we enforce in S3Boto3Storage that any auto-created
                    # bucket must match the region that the connection is for.
                    #
                    # Also note that Amazon specifically disallows "us-east-1" when passing bucket
                    # region names; LocationConstraint *must* be blank to create in US Standard.
                    bucket_params = {"ACL": self.bucket_acl}
                    region_name = self.connection.meta.client.meta.region_name
                    if region_name != "us-east-1":
                        bucket_params["CreateBucketConfiguration"] = {
                            "LocationConstraint": region_name
                        }
                    bucket.create(ACL=self.bucket_acl)
                else:
                    raise ImproperlyConfigured(
                        "Bucket %s does not exist. Buckets "
                        "can be automatically created by "
                        "setting AWS_AUTO_CREATE_BUCKET to "
                        "``True``." % name
                    )
        return bucket

    def _clean_name(self, name):
        """
        Cleans the name so that Windows style paths work
        """
        # Normalize Windows style paths
        clean_name = posixpath.normpath(name).replace("\\", "/")

        # os.path.normpath() can strip trailing slashes so we implement
        # a workaround here.
        if name.endswith("/") and not clean_name.endswith("/"):
            # Add a trailing slash as it was stripped.
            return clean_name + "/"
        else:
            return clean_name

    def _normalize_name(self, name):
        """
        Normalizes the name so that paths like /path/to/ignored/../something.txt
        work. We check to make sure that the path pointed to is not outside
        the directory specified by the LOCATION setting.
        """
        try:
            return safe_join(self.location, name)
        except ValueError:
            raise SuspiciousOperation("Attempted access to '%s' denied." % name)

    def _encode_name(self, name):
        return smart_str(name, encoding=self.file_name_charset)

    def _decode_name(self, name):
        return force_text(name, encoding=self.file_name_charset)

    def _compress_content(self, content):
        """Gzip a given string content."""
        zbuf = BytesIO()
        zfile = GzipFile(mode="wb", compresslevel=6, fileobj=zbuf)
        try:
            zfile.write(force_bytes(content.read()))
        finally:
            zfile.close()
        zbuf.seek(0)
        # Boto 2 returned the InMemoryUploadedFile with the file pointer replaced,
        # but Boto 3 seems to have issues with that. No need for fp.name in Boto3
        # so just returning the BytesIO directly
        return zbuf

    def _open(self, name, mode="rb"):
        name = self._normalize_name(self._clean_name(name))
        try:
            f = self.file_class(name, mode, self)
        except self.connection_response_error as err:
            if err.response["ResponseMetadata"]["HTTPStatusCode"] == 404:
                raise IOError("File does not exist: %s" % name)
            raise  # Let it bubble up if it was some other error
        return f

    def _save(self, name, content):
        with metrics.timer("filestore.save", instance="s3"):
            cleaned_name = self._clean_name(name)
            name = self._normalize_name(cleaned_name)
            parameters = self.object_parameters.copy()
            content_type = getattr(
                content, "content_type", mimetypes.guess_type(name)[0] or self.default_content_type
            )

            # setting the content_type in the key object is not enough.
            parameters.update({"ContentType": content_type})

            if self.gzip and content_type in self.gzip_content_types:
                content = self._compress_content(content)
                parameters.update({"ContentEncoding": "gzip"})

            encoded_name = self._encode_name(name)
            obj = self.bucket.Object(encoded_name)
            if self.preload_metadata:
                self._entries[encoded_name] = obj

            self._save_content(obj, content, parameters=parameters)
            # Note: In boto3, after a put, last_modified is automatically reloaded
            # the next time it is accessed; no need to specifically reload it.
        return cleaned_name

    def _save_content(self, obj, content, parameters):
        # only pass backwards incompatible arguments if they vary from the default
        put_parameters = parameters.copy() if parameters else {}
        if self.encryption:
            put_parameters["ServerSideEncryption"] = "AES256"
        if self.reduced_redundancy:
            put_parameters["StorageClass"] = "REDUCED_REDUNDANCY"
        if self.default_acl:
            put_parameters["ACL"] = self.default_acl
        content.seek(0, os.SEEK_SET)
        obj.upload_fileobj(content, ExtraArgs=put_parameters)

    def delete(self, name):
        name = self._normalize_name(self._clean_name(name))
        self.bucket.Object(self._encode_name(name)).delete()

    def exists(self, name):
        if not name:
            try:
                self.bucket
                return True
            except ImproperlyConfigured:
                return False
        name = self._normalize_name(self._clean_name(name))
        if self.entries:
            return name in self.entries
        obj = self.bucket.Object(self._encode_name(name))
        try:
            obj.load()
            return True
        except self.connection_response_error:
            return False

    def listdir(self, name):
        name = self._normalize_name(self._clean_name(name))
        # for the bucket.objects.filter and logic below name needs to end in /
        # But for the root path "" we leave it as an empty string
        if name and not name.endswith("/"):
            name += "/"

        files = []
        dirs = set()
        base_parts = name.split("/")[:-1]
        for item in self.bucket.objects.filter(Prefix=self._encode_name(name)):
            parts = item.key.split("/")
            parts = parts[len(base_parts) :]
            if len(parts) == 1:
                # File
                files.append(parts[0])
            elif len(parts) > 1:
                # Directory
                dirs.add(parts[0])
        return list(dirs), files

    def size(self, name):
        name = self._normalize_name(self._clean_name(name))
        if self.entries:
            entry = self.entries.get(name)
            if entry:
                return entry.content_length
            return 0
        return self.bucket.Object(self._encode_name(name)).content_length

    def get_modified_time(self, name):
        """
        Returns an (aware) datetime object containing the last modified time if
        USE_TZ is True, otherwise returns a naive datetime in the local timezone.
        """
        name = self._normalize_name(self._clean_name(name))
        entry = self.entries.get(name)
        # only call self.bucket.Object() if the key is not found
        # in the preloaded metadata.
        if entry is None:
            entry = self.bucket.Object(self._encode_name(name))
        if settings.USE_TZ:
            # boto3 returns TZ aware timestamps
            return entry.last_modified
        else:
            return localtime(entry.last_modified).replace(tzinfo=None)

    def modified_time(self, name):
        """Returns a naive datetime object containing the last modified time."""
        return localtime(self.get_modified_time(name)).replace(tzinfo=None)

    def _strip_signing_parameters(self, url):
        # Boto3 does not currently support generating URLs that are unsigned. Instead we
        # take the signed URLs and strip any querystring params related to signing and expiration.
        # Note that this may end up with URLs that are still invalid, especially if params are
        # passed in that only work with signed URLs, e.g. response header params.
        # The code attempts to strip all query parameters that match names of known parameters
        # from v2 and v4 signatures, regardless of the actual signature version used.
        split_url = urlparse.urlsplit(url)
        qs = urlparse.parse_qsl(split_url.query, keep_blank_values=True)
        blacklist = set(
            [
                "x-amz-algorithm",
                "x-amz-credential",
                "x-amz-date",
                "x-amz-expires",
                "x-amz-signedheaders",
                "x-amz-signature",
                "x-amz-security-token",
                "awsaccesskeyid",
                "expires",
                "signature",
            ]
        )
        filtered_qs = ((key, val) for key, val in qs if key.lower() not in blacklist)
        # Note: Parameters that did not have a value in the original query string will have
        # an '=' sign appended to it, e.g ?foo&bar becomes ?foo=&bar=
        joined_qs = ("=".join(keyval) for keyval in filtered_qs)
        split_url = split_url._replace(query="&".join(joined_qs))
        return split_url.geturl()

    def url(self, name, parameters=None, expire=None):
        # Preserve the trailing slash after normalizing the path.
        # TODO: Handle force_http=not self.secure_urls like in s3boto
        name = self._normalize_name(self._clean_name(name))
        if self.custom_domain:
            return "%s//%s/%s" % (self.url_protocol, self.custom_domain, filepath_to_uri(name))
        if expire is None:
            expire = self.querystring_expire

        params = parameters.copy() if parameters else {}
        params["Bucket"] = self.bucket.name
        params["Key"] = self._encode_name(name)
        url = self.bucket.meta.client.generate_presigned_url(
            "get_object", Params=params, ExpiresIn=expire
        )
        if self.querystring_auth:
            return url
        return self._strip_signing_parameters(url)

    def get_available_name(self, name, max_length=None):
        """Overwrite existing file with the same name."""
        if self.file_overwrite:
            name = self._clean_name(name)
            return name
        return super(S3Boto3Storage, self).get_available_name(name, max_length)
