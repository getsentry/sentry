from __future__ import annotations

import io
import tarfile
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import IO, Any, NamedTuple

import orjson
from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from google.cloud.kms import KeyManagementServiceClient as KeyManagementServiceClient
from google_crc32c import value as crc32c

from sentry.utils.env import gcp_project_id


class CryptoKeyVersion(NamedTuple):
    """
    A structured version of a Google Cloud KMS CryptoKeyVersion, as described here:
    https://cloud.google.com/kms/docs/resource-hierarchy#retrieve_resource_id
    """

    project_id: str
    location: str
    key_ring: str
    key: str
    version: str


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def get_default_crypto_key_version() -> CryptoKeyVersion:
    # TODO(getsentry/team-ospo#215): These should be options, instead of hard coding.
    return CryptoKeyVersion(
        project_id=gcp_project_id(),
        location="global",
        key_ring="relocation",
        key="relocation",
        # TODO(getsentry/team-ospo#190): This version should be pulled from an option, rather than
        # hard coded.
        version="1",
    )


class EncryptionError(Exception):
    pass


class Encryptor(ABC):
    """
    A `IO[bytes]`-wrapper that contains relevant information and methods to encrypt some an in-memory JSON-ifiable dict.
    """

    @abstractmethod
    def get_public_key_pem(self) -> bytes:
        pass


class LocalFileEncryptor(Encryptor):
    """
    Encrypt using a public key stored on the local machine.
    """

    def __init__(self, fp: IO[bytes]):
        self.__key = fp.read()

    def get_public_key_pem(self) -> bytes:
        return self.__key


class GCPKMSEncryptor(Encryptor):
    """
    Encrypt using a config JSON file tha pulls the public key from Google Cloud Platform's Key
    Management Service.
    """

    crypto_key_version: CryptoKeyVersion | None = None

    def __init__(self, fp: IO[bytes]):
        self.__key = fp.read()

    @classmethod
    def from_crypto_key_version(cls, crypto_key_version: CryptoKeyVersion) -> GCPKMSEncryptor:
        instance = cls(io.BytesIO(b""))
        instance.crypto_key_version = crypto_key_version
        return instance

    def get_public_key_pem(self) -> bytes:
        if self.crypto_key_version is None:
            # Read the user supplied configuration into the proper format.
            gcp_kms_config_json = orjson.loads(self.__key)
            try:
                self.crypto_key_version = CryptoKeyVersion(**gcp_kms_config_json)
            except TypeError:
                raise EncryptionError(
                    """Your supplied KMS configuration did not have the correct fields - please
                    ensure that it is a single, top-level object with the fields `project_id`
                    `location`, `key_ring`, `key`, and `version`, with all values as strings."""
                )

        kms_client = KeyManagementServiceClient()
        key_name = kms_client.crypto_key_version_path(
            project=self.crypto_key_version.project_id,
            location=self.crypto_key_version.location,
            key_ring=self.crypto_key_version.key_ring,
            crypto_key=self.crypto_key_version.key,
            crypto_key_version=self.crypto_key_version.version,
        )
        public_key = kms_client.get_public_key(request={"name": key_name})
        return public_key.pem.encode("utf-8")


def create_encrypted_export_tarball(json_export: Any, encryptor: Encryptor) -> io.BytesIO:
    """
    Generate a tarball with 3 files:

      1. The DEK we minted, name "data.key".
      2. The public key we used to encrypt that DEK, named "key.pub".
      3. The exported JSON data, encrypted with that DEK, named "export.json".

    The upshot: to decrypt the exported JSON data, you need the plaintext (decrypted) DEK. But to
    decrypt the DEK, you need the private key associated with the included public key, which
    you've hopefully kept in a safe, trusted location.

    Note that the supplied file names are load-bearing - ex, changing to `data.key` to `foo.key`
    risks breaking assumptions that the decryption side will make on the other end!
    """

    # Generate a new DEK (data encryption key), and use that DEK to encrypt the JSON being exported.
    pem = encryptor.get_public_key_pem()
    data_encryption_key = Fernet.generate_key()
    backup_encryptor = Fernet(data_encryption_key)
    encrypted_json_export = backup_encryptor.encrypt(orjson.dumps(json_export))

    # Encrypt the newly minted DEK using asymmetric public key encryption.
    dek_encryption_key = serialization.load_pem_public_key(pem, default_backend())
    sha256 = hashes.SHA256()
    mgf = padding.MGF1(algorithm=sha256)
    oaep_padding = padding.OAEP(mgf=mgf, algorithm=sha256, label=None)
    encrypted_dek = dek_encryption_key.encrypt(data_encryption_key, oaep_padding)  # type: ignore[union-attr]

    # Generate the tarball and write it to to a new output stream.
    tar_buffer = io.BytesIO()
    with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
        json_info = tarfile.TarInfo("export.json")
        json_info.size = len(encrypted_json_export)
        tar.addfile(json_info, fileobj=io.BytesIO(encrypted_json_export))
        key_info = tarfile.TarInfo("data.key")
        key_info.size = len(encrypted_dek)
        tar.addfile(key_info, fileobj=io.BytesIO(encrypted_dek))
        pub_info = tarfile.TarInfo("key.pub")
        pub_info.size = len(pem)
        tar.addfile(pub_info, fileobj=io.BytesIO(pem))

    return tar_buffer


class UnwrappedEncryptedExportTarball(NamedTuple):
    """
    A tarball generated by an encrypted export request contains three elements:

      1. The DEK we minted, name "data.key".
      2. The public key we used to encrypt that DEK, named "key.pub".
      3. The exported JSON data, encrypted with that DEK, named "export.json".

    This class tracks them as separate objects.
    """

    plain_public_key_pem: bytes
    encrypted_data_encryption_key: bytes
    encrypted_json_blob: str


def unwrap_encrypted_export_tarball(tarball: IO[bytes]) -> UnwrappedEncryptedExportTarball:
    export = None
    encrypted_dek = None
    public_key_pem = None
    with tarfile.open(fileobj=tarball, mode="r") as tar:
        for member in tar.getmembers():
            if member.isfile():
                file = tar.extractfile(member)
                if file is None:
                    raise ValueError(f"Could not extract file for {member.name}")

                content = file.read()
                if member.name == "export.json":
                    export = content.decode("utf-8")
                elif member.name == "data.key":
                    encrypted_dek = content
                elif member.name == "key.pub":
                    public_key_pem = content
                else:
                    raise ValueError(f"Unknown tarball entity {member.name}")

    if export is None or encrypted_dek is None or public_key_pem is None:
        raise ValueError("A required file was missing from the temporary test tarball")

    return UnwrappedEncryptedExportTarball(
        plain_public_key_pem=public_key_pem,
        encrypted_data_encryption_key=encrypted_dek,
        encrypted_json_blob=export,
    )


class DecryptionError(Exception):
    pass


class Decryptor(ABC):
    """
    A `IO[bytes]`-wrapper that contains relevant information and methods to decrypt an encrypted
    tarball.
    """

    @abstractmethod
    def decrypt_data_encryption_key(self, unwrapped: UnwrappedEncryptedExportTarball) -> bytes:
        pass


class LocalFileDecryptor(Decryptor):
    """
    Decrypt using a private key stored on the local machine.
    """

    def __init__(self, fp: IO[bytes]):
        self.__key = fp.read()

    @classmethod
    def from_bytes(cls, b: bytes) -> LocalFileDecryptor:
        return cls(io.BytesIO(b))

    def decrypt_data_encryption_key(self, unwrapped: UnwrappedEncryptedExportTarball) -> bytes:
        """
        Decrypt the encrypted data encryption key used to encrypt the actual export JSON.
        """

        # Compare the public and private key, to ensure that they are a match.
        private_key_pem = self.__key
        private_key = serialization.load_pem_private_key(
            private_key_pem,
            password=None,
            backend=default_backend(),
        )
        generated_public_key_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        if unwrapped.plain_public_key_pem != generated_public_key_pem:
            raise DecryptionError(
                "The public key does not match that generated by the `decrypt_with` private key."
            )

        private_key = serialization.load_pem_private_key(
            private_key_pem,
            password=None,
            backend=default_backend(),
        )
        return private_key.decrypt(  # type: ignore[union-attr]
            unwrapped.encrypted_data_encryption_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )


class GCPKMSDecryptor(Decryptor):
    """
    Decrypt using a config JSON file that uses remote decryption over Google Cloud Platform's Key
    Management Service.
    """

    def __init__(self, fp: IO[bytes]):
        self.__key = fp.read()

    @classmethod
    def from_bytes(cls, b: bytes) -> GCPKMSDecryptor:
        return cls(io.BytesIO(b))

    def decrypt_data_encryption_key(self, unwrapped: UnwrappedEncryptedExportTarball) -> bytes:
        gcp_kms_config_bytes = self.__key

        # Read the user supplied configuration into the proper format.
        gcp_kms_config_json = orjson.loads(gcp_kms_config_bytes)
        try:
            crypto_key_version = CryptoKeyVersion(**gcp_kms_config_json)
        except TypeError:
            raise DecryptionError(
                """Your supplied KMS configuration did not have the correct fields - please
                ensure that it is a single, top-level object with the fields `project_id`
                `location`, `key_ring`, `key`, and `version`, with all values as strings."""
            )

        kms_client = KeyManagementServiceClient()
        key_name = kms_client.crypto_key_version_path(
            project=crypto_key_version.project_id,
            location=crypto_key_version.location,
            key_ring=crypto_key_version.key_ring,
            crypto_key=crypto_key_version.key,
            crypto_key_version=crypto_key_version.version,
        )
        ciphertext = unwrapped.encrypted_data_encryption_key
        dek_crc32c = crc32c(ciphertext)
        decrypt_response = kms_client.asymmetric_decrypt(
            request={
                "name": key_name,
                "ciphertext": ciphertext,
                "ciphertext_crc32c": dek_crc32c,
            }
        )
        if not decrypt_response.plaintext_crc32c == crc32c(decrypt_response.plaintext):
            raise DecryptionError("The response received from the server was corrupted in-transit.")

        return decrypt_response.plaintext


def decrypt_encrypted_tarball(tarball: IO[bytes], decryptor: Decryptor) -> bytes:
    """
    A tarball encrypted by a call to `_export` with `encrypt_with` set has some specific properties
    (filenames, etc). This method handles all of those, and decrypts using the provided private key
    into an in-memory JSON string.
    """

    unwrapped = unwrap_encrypted_export_tarball(tarball)

    # Decrypt the DEK, then use it to decrypt the underlying JSON.
    decrypted_dek = decryptor.decrypt_data_encryption_key(unwrapped)
    fernet = Fernet(decrypted_dek)
    return fernet.decrypt(unwrapped.encrypted_json_blob)


class EncryptorDecryptorPair:
    """
    An Encryptor and Decryptor that use paired public and private keys, respectively.
    """

    def __init__(self, encryptor: Encryptor, decryptor: Decryptor):
        self.encryptor = encryptor
        self.decryptor = decryptor
