from __future__ import annotations

from collections.abc import Generator, Sequence
from contextlib import contextmanager
from datetime import timedelta
from io import BytesIO
from threading import Event, Thread
from time import sleep, time
from typing import IO, Any

import click

# We have to use the default JSON interface to enable pretty-printing on export. When loading JSON,
# we still use the one from `sentry.utils`, imported as `json` below.
import orjson  # noqa: S003

from sentry.backup.comparators import get_default_comparators
from sentry.backup.crypto import (
    DecryptionError,
    Decryptor,
    Encryptor,
    GCPKMSDecryptor,
    GCPKMSEncryptor,
    LocalFileDecryptor,
    LocalFileEncryptor,
    create_encrypted_export_tarball,
    decrypt_encrypted_tarball,
)
from sentry.backup.findings import Finding, FindingJSONEncoder
from sentry.backup.helpers import ImportFlags, Printer, Side
from sentry.backup.sanitize import sanitize
from sentry.backup.validate import validate
from sentry.runner.decorators import configuration
from sentry.silo.base import SiloMode
from sentry.utils import json
from sentry.utils.env import is_split_db

DEFAULT_INDENT = 2

DECRYPT_WITH_HELP = """A path to a file containing a private key with which to decrypt a tarball
                    previously encrypted using an `export ... --encrypt_with=<PUBLIC_KEY>` command.
                    The private key provided via this flag should be the complement of the 2048-bit
                    public RSA key used to encrypt the tarball (this public key is included in the
                    tarball itself).

                    This flag is mutually exclusive with the `--decrypt-with-gcp-kms` flag."""

DECRYPT_WITH_GCP_KMS_HELP = """For users that want to avoid storing their own private keys, this
                            flag can be used in lieu of `--decrypt-with` to retrieve keys from
                            Google Cloud's Key Management Service directly, avoiding ever storing
                            them on the machine doing the decryption.

                            This flag should point to a JSON file containing a single top-level
                            object storing the `project-id`, `location`, `keyring`, `key`, and
                            `version` of the desired asymmetric private key that pairs with the
                            2048-bit public RSA key in text (PEM) format included in the tarball
                            being imported (for more information on these resource identifiers and
                            how to set up KMS to use the, see:
                            https://cloud.google.com/kms/docs/getting-resource-ids). An example
                            version of this file might look like:

                            ``` {
                                "project_id": "my-google-cloud-project",
                                "location": "global",
                                "key_ring": "my-key-ring-name",
                                "key": "my-key-name",
                                "version": "1"
                            }
                            ```

                            Property names must be spelled exactly as above, and the `version` field
                            in particular must be a string, not an integer."""

ENCRYPT_WITH_HELP = """A path to the 2048-bit public RSA key in text (PEM) format with which to
                       encrypt this export. If this flag is enabled and points to a valid key, the
                       output file will be a tarball containing 3 constituent files: 1. An encrypted
                       JSON file called `export.json`, which is encrypted using 2. An asymmetrically
                       encrypted data encryption key (DEK) called `data.key`, which is itself
                       encrypted by 3. The public key contained in the file supplied to this flag,
                       called `key.pub`. To decrypt the exported JSON data, decryptors should use
                       the private key paired with `key.pub` to decrypt the DEK, which can then be
                       used to decrypt the export data in `export.json`."""

ENCRYPT_WITH_GCP_KMS_HELP = """For users that want to avoid storing their own public keys, this
                            flag can be used in lieu of `--encrypt-with` to retrieve those keys from
                            Google Cloud's Key Management Service directly, avoiding ever storing
                            them on the machine doing the encryption.

                            This flag should point to a JSON file containing a single top-level
                            object storing the `project-id`, `location`, `keyring`, `key`, and
                            `version` of the desired asymmetric public key that pairs will be used
                            to encrypt the final tarball being exported (for more information on
                            these resource identifiers and how to set up KMS to use the, see:
                            https://cloud.google.com/kms/docs/getting-resource-ids). An example
                            version of this file might look like:

                            ``` {
                                "project_id": "my-google-cloud-project",
                                "location": "global",
                                "key_ring": "my-key-ring-name",
                                "key": "my-key-name",
                                "version": "1"
                            }
                            ```

                            Property names must be spelled exactly as above, and the `version`
                            field in particular must be a string, not an integer."""

FINDINGS_FILE_HELP = """Optional file that records comparator findings, saved in the JSON format.
                     If left unset, no such file is written."""

INDENT_HELP = "Number of spaces to indent for the JSON output. (default: 2)"

MERGE_USERS_HELP = """If this flag is set and users in the import JSON have matching usernames to
                   those already in the database, the existing users are used instead and their
                   associated user scope models are not updated. If this flag is not set, new users
                   are always created in the event of a collision, with the new user receiving a
                   random suffix to their username."""

NO_PROMPT_HELP = """When set, always answers `YES` to any confirmation dialogs. This can
                 be dangerous (the dialogs are there to make sure that you REALLY want to proceed
                 with an irrecoverable operation), but can be useful when these commands are meant
                 to be consumed by scripts and automation."""

OVERWRITE_CONFIGS_HELP = """Imports are generally non-destructive of old data. However, if this flag
                         is set and a global configuration, like an option or a relay id, collides
                         with an existing value, the new value will overwrite the existing one. If
                         the flag is left in its (default) unset state, the old value will be
                         retained in the event of a collision."""

SILENT_HELP = """Silence all debug output. To silence confirmation dialogs as well, use
               --no-prompt."""


class OutputOnlyPrinter(Printer):
    """
    A printer that writes debug output, but does not ask for confirmations.
    """

    def echo(
        self,
        text: str,
        *,
        err: bool = False,
        color: bool | None = None,
    ) -> None:
        return click.echo(text, err=err, color=color)


class InputOnlyPrinter(Printer):
    """
    A printer that only asks for confirmations, and is otherwise silent.
    """

    def confirm(
        self,
        text: str,
        *,
        default: bool | None = None,
        err: bool = False,
    ) -> bool:
        return click.confirm(text, default=default, err=err)


class InputOutputPrinter(InputOnlyPrinter, OutputOnlyPrinter):
    """
    This printer does it all - it prints debug output AND asks for confirmation before continuing!
    """


def get_printer(silent: bool, no_prompt: bool) -> Printer:
    """
    Based on user flags, we select the right kind of printer for them: a noop that is completely
    silent (`Printer`), one that only prints and automatically approves all confirmation dialogs
    (`OutputOnlyPrinter`), one that only shows confirmation dialogs but is otherwise silent
    (`InputOnlyPrinter`), or one that shows all output and dialogs (`InputOutputPrinter`).
    """

    if silent and no_prompt:
        return Printer()
    if no_prompt:
        return OutputOnlyPrinter()
    if silent:
        return InputOnlyPrinter()
    return InputOutputPrinter()


def get_filter_arg(name: str, from_cmd_line: str, from_file: IO[str] | None) -> str:
    """
    Helper function to load `--filter-...`-style arguments from a file or the command line.
    """

    if from_cmd_line and from_file is not None:
        raise click.UsageError(
            f"""`--{name}` and `--{name}--file` are mutually exclusive options - you
            may use one or the other, but not both."""
        )

    return from_file.read() if from_file is not None else from_cmd_line


def parse_filter_arg(filter_arg: str) -> set[str] | None:
    filter_by = None
    if filter_arg:
        filter_by = set(filter_arg.split(","))

    return filter_by


def get_decryptor_from_flags(
    decrypt_with: IO[bytes] | None, decrypt_with_gcp_kms: IO[bytes] | None
) -> Decryptor | None:
    """
    Helper function to select the right decryptor class based on the supplied flag: use GCP KMS, use
    a local key, or don't decrypt at all.
    """

    if decrypt_with is not None and decrypt_with_gcp_kms is not None:
        raise click.UsageError(
            """`--decrypt-with` and `--decrypt-with-gcp-kms` are mutually exclusive options - you
            may use one or the other, but not both."""
        )

    if decrypt_with is not None:
        return LocalFileDecryptor(decrypt_with)
    if decrypt_with_gcp_kms is not None:
        return GCPKMSDecryptor(decrypt_with_gcp_kms)
    return None


def get_encryptor_from_flags(
    encrypt_with: IO[bytes] | None, encrypt_with_gcp_kms: IO[bytes] | None
) -> Encryptor | None:
    """
    Helper function to select the right encryptor class based on the supplied flag: use GCP KMS, use
    a local key, or don't encrypt at all.
    """

    if encrypt_with is not None and encrypt_with_gcp_kms is not None:
        raise click.UsageError(
            """`--encrypt-with` and `--encrypt-with-gcp-kms` are mutually exclusive options - you
            may use one or the other, but not both."""
        )

    if encrypt_with is not None:
        return LocalFileEncryptor(encrypt_with)
    if encrypt_with_gcp_kms is not None:
        return GCPKMSEncryptor(encrypt_with_gcp_kms)
    return None


def write_findings(
    findings_file: IO[str] | None, findings: Sequence[Finding], printer: Printer
) -> None:
    for f in findings:
        printer.echo(f"\n\n{f.pretty()}", err=True)

    if findings_file:
        findings_encoder = FindingJSONEncoder(
            sort_keys=True,
            ensure_ascii=True,
            check_circular=True,
            allow_nan=True,
            indent=DEFAULT_INDENT,
            encoding="utf-8",
        )

        with findings_file as file:
            encoded = findings_encoder.encode(findings)
            file.write(encoded)


def print_elapsed_time(kind: str, interval_ms: int, done_event: Event, printer: Printer) -> None:
    """
    Prints an update every `interval_ms` seconds. Intended to be run on a separate thread. When that
    thread is done with its work, it should `done_event.set()` to indicate to this thread to finish
    as well.
    """
    start_time = time()
    last_print_time = start_time
    check_interval = 1  # Check every second if we should exit

    while not done_event.is_set():
        current_time = time()
        diff_ms = (current_time - last_print_time) * 1000
        if diff_ms >= interval_ms:
            printer.echo(f"{kind}: {(current_time - start_time):.2f} seconds elapsed.")
            last_print_time = current_time
        sleep(check_interval)


@contextmanager
def write_import_findings(findings_file: IO[str] | None, printer: Printer) -> Generator[None]:
    """
    Helper that ensures that we write findings for the `import ...` command regardless of outcome.
    """

    from sentry.backup.imports import ImportingError

    done_event = Event()
    updater_thread = Thread(
        target=print_elapsed_time, args=("Still importing", 5000, done_event, printer)
    )

    try:
        updater_thread.start()
        yield
    except ImportingError as e:
        if e.context:
            write_findings(findings_file, [e.context], printer)
        raise
    else:
        write_findings(findings_file, [], printer)
    finally:
        done_event.set()
        updater_thread.join()


@contextmanager
def write_export_findings(findings_file: IO[str] | None, printer: Printer) -> Generator[None]:
    """
    Helper that ensures that we write findings for the `export ...` command regardless of outcome.
    """

    from sentry.backup.exports import ExportingError

    done_event = Event()
    updater_thread = Thread(
        target=print_elapsed_time, args=("Still exporting", 5000, done_event, printer)
    )

    try:
        updater_thread.start()
        yield
    except ExportingError as e:
        if e.context:
            write_findings(findings_file, [e.context], printer)
        raise
    else:
        write_findings(findings_file, [], printer)
    finally:
        done_event.set()
        updater_thread.join()


@click.group(name="backup")
def backup() -> None:
    """Helper tools for operating on Sentry backup imports/exports."""


@backup.command(name="compare")
@click.argument("left", type=click.File("rb"))
@click.argument("right", type=click.File("rb"))
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--decrypt-left-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-left-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--decrypt-right-with",
    type=click.File("rb"),
    help="Identical to `--decrypt-left-with`, but for the 2nd input argument.",
)
@click.option(
    "--decrypt-right-with-gcp-kms",
    type=click.File("rb"),
    help="Identical to `--decrypt-left-with-gcp-kms`, but for the 2nd input argument.",
)
@configuration
def compare(
    left: IO[bytes],
    right: IO[bytes],
    decrypt_left_with: IO[bytes],
    decrypt_left_with_gcp_kms: IO[bytes],
    decrypt_right_with: IO[bytes],
    decrypt_right_with_gcp_kms: IO[bytes],
    findings_file: IO[str],
) -> None:
    """
    Compare two exports generated by the `export` command for equality, modulo certain necessary
    expected differences like `date_updated` timestamps, unique tokens, and the like.
    """

    # Helper function that loads data from one of the two sides, decrypting it if necessary along
    # the way.
    def load_data(
        side: Side, src: IO[bytes], decrypt_with: IO[bytes], decrypt_with_gcp_kms: IO[bytes]
    ) -> dict[str, Any]:
        decryptor = get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms)

        # Decrypt the tarball, if the user has indicated that this is one by using either of the
        # `--decrypt...` flags.
        if decryptor is not None:
            try:
                input: IO[bytes] = BytesIO(decrypt_encrypted_tarball(src, decryptor))
            except DecryptionError as e:
                click.echo(f"Invalid {side.name} side tarball: {str(e)}", err=True)
                raise
        else:
            input = src

        # Now read the input string into memory as json data.
        try:
            data = json.load(input)
        except json.JSONDecodeError:
            click.echo(f"Invalid {side.name} JSON", err=True)
            raise

        return data

    try:
        with left:
            left_data = load_data(Side.left, left, decrypt_left_with, decrypt_left_with_gcp_kms)
        with right:
            right_data = load_data(
                Side.right, right, decrypt_right_with, decrypt_right_with_gcp_kms
            )

        printer = InputOutputPrinter()
        res = validate(left_data, right_data, get_default_comparators())
        if res:
            click.echo(f"\n\nDone, found {len(res.findings)} differences:")
            write_findings(findings_file, res.findings, printer)
        else:
            click.echo("\n\nDone, found 0 differences!")
            write_findings(findings_file, [], printer)
    except (DecryptionError, json.JSONDecodeError):
        # Already reported to the user from the `load_data` function.
        pass


@backup.command(name="decrypt")
@click.argument("dest", type=click.File("wb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--src",
    required=True,
    type=click.File("rb"),
    help="The output tarball file that needs to be decrypted.",
)
@configuration
def decrypt(
    dest: IO[bytes], decrypt_with: IO[bytes], decrypt_with_gcp_kms: IO[bytes], src: IO[bytes]
) -> None:
    """
    Decrypt an encrypted tarball export into an unencrypted JSON file.
    """

    # Decrypt the tarball, if the user has indicated that this is one by using either of the
    # `--decrypt...` flags.
    decryptor = get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms)
    if decryptor is None:
        raise click.UsageError(
            """You must specify one of `--decrypt-with` or `--decrypt-with-gcp-kms`."""
        )

    try:
        decrypted = decrypt_encrypted_tarball(src, decryptor)
    except DecryptionError as e:
        click.echo(f"Invalid tarball: {str(e)}", err=True)
    else:
        with dest:
            dest.write(decrypted)


@backup.command(name="encrypt")
@click.argument("dest", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--encrypt-with-gcp-kms",
    type=click.File("rb"),
    help=ENCRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--src",
    required=True,
    type=click.File("rb"),
    help="The input JSON file that needs to be encrypted.",
)
@configuration
def encrypt(
    dest: IO[bytes], encrypt_with: IO[bytes], encrypt_with_gcp_kms: IO[bytes], src: IO[bytes]
) -> None:
    """
    Encrypt an unencrypted raw JSON export into an encrypted tarball.
    """

    # Encrypt the raw JSON file, if the user has indicated that this is desired by using either of
    # the `--encrypt...` flags.
    encryptor = get_encryptor_from_flags(encrypt_with, encrypt_with_gcp_kms)
    if encryptor is None:
        raise click.UsageError(
            """You must specify one of `--encrypt-with` or `--encrypt-with-gcp-kms`."""
        )

    try:
        data = json.load(src)
    except json.JSONDecodeError:
        click.echo("Invalid input JSON", err=True)
    else:
        encrypted = create_encrypted_export_tarball(data, encryptor)
        with dest:
            dest.write(encrypted.getbuffer())


@backup.command(name="sanitize")
@click.argument("dest", type=click.File("wb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--encrypt-with",
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--encrypt-with-gcp-kms",
    type=click.File("rb"),
    help=ENCRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--days-offset",
    type=int,
    help="The number of days to adjust the date range seen in the JSON being sanitized.",
)
@click.option(
    "--src",
    required=True,
    type=click.File("rb"),
    help="The input JSON file that needs to be sanitized.",
)
@configuration
def sanitize_(
    dest: IO[bytes],
    decrypt_with: IO[bytes],
    decrypt_with_gcp_kms: IO[bytes],
    encrypt_with: IO[bytes],
    encrypt_with_gcp_kms: IO[bytes],
    days_offset: int | None,
    src: IO[bytes],
) -> None:
    """
    Sanitize PII from a backup.
    """

    decryptor = get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms)

    # Decrypt the tarball, if the user has indicated that this is one via the use of one of the
    # `--decrypt...` flags.
    if decryptor is not None:
        try:
            input: IO[bytes] = BytesIO(decrypt_encrypted_tarball(src, decryptor))
        except DecryptionError as e:
            click.echo(f"Invalid tarball: {str(e)}", err=True)
            raise
    else:
        input = src

    # Now read the input string into memory as json data.
    try:
        unsanitized_json = json.load(input)
    except json.JSONDecodeError:
        click.echo("Invalid JSON", err=True)
        raise

    # Perform the sanitization.
    datetime_offset = timedelta(days=days_offset) if days_offset is not None else None
    sanitized_json = sanitize(unsanitized_json, datetime_offset)

    # Encrypt the raw JSON file, if the user has indicated that this is desired by using either of
    # the `--encrypt...` flags.
    encryptor = get_encryptor_from_flags(encrypt_with, encrypt_with_gcp_kms)

    # If no `encryptor` was passed in, this is an unencrypted write, so we can just dump the JSON
    # into the `dest` file directly.
    if encryptor is None:
        dest.write(orjson.dumps(sanitized_json, option=orjson.OPT_INDENT_2 | orjson.OPT_UTC_Z))
    else:
        dest.write(create_encrypted_export_tarball(sanitized_json, encryptor).getbuffer())


@click.group(name="import")
def import_() -> None:
    """Imports core data for a Sentry installation."""


@import_.command(name="users")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--filter-usernames",
    default="",
    type=str,
    help="An optional comma-separated list of users to include. "
    "If this option is not set, all encountered users are imported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--filter-usernames-file",
    type=click.File("r"),
    help="Like `--filter-usernames`, except it pulls from a comma-separated file.",
)
@click.option(
    "--merge-users",
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def import_users(
    src: IO[bytes],
    decrypt_with: IO[bytes],
    decrypt_with_gcp_kms: IO[bytes],
    filter_usernames: str,
    filter_usernames_file: IO[str],
    findings_file: IO[str],
    merge_users: bool,
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Import the Sentry users from an exported JSON file.
    """

    from sentry.backup.imports import import_in_user_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_import_findings(findings_file, printer):
        import_in_user_scope(
            src,
            decryptor=get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(merge_users=merge_users),
            user_filter=parse_filter_arg(
                get_filter_arg("filter-usernames", filter_usernames, filter_usernames_file)
            ),
            printer=printer,
        )


@import_.command(name="organizations")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--filter-org-slugs",
    default="",
    type=str,
    help="An optional comma-separated list of organization slugs to include. "
    "If this option is not set, all encountered organizations are imported. "
    "Users not members of at least one organization in this set will not be imported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--merge-users",
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def import_organizations(
    src: IO[bytes],
    decrypt_with: IO[bytes],
    decrypt_with_gcp_kms: IO[bytes],
    filter_org_slugs: str,
    findings_file: IO[str],
    merge_users: bool,
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Import the Sentry organizations, and all constituent Sentry users, from an exported JSON file.
    """

    from sentry.backup.imports import import_in_organization_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_import_findings(findings_file, printer):
        import_in_organization_scope(
            src,
            decryptor=get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(merge_users=merge_users),
            org_filter=parse_filter_arg(filter_org_slugs),
            printer=printer,
        )


@import_.command(name="config")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--merge-users",
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--overwrite-configs",
    default=False,
    is_flag=True,
    help=OVERWRITE_CONFIGS_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def import_config(
    src: IO[bytes],
    decrypt_with: IO[bytes],
    decrypt_with_gcp_kms: IO[bytes],
    findings_file: IO[str],
    merge_users: bool,
    no_prompt: bool,
    overwrite_configs: bool,
    silent: bool,
) -> None:
    """
    Import all configuration and administrator accounts needed to set up this Sentry instance.
    """

    from sentry.backup.imports import import_in_config_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_import_findings(findings_file, printer):
        import_in_config_scope(
            src,
            decryptor=get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(merge_users=merge_users, overwrite_configs=overwrite_configs),
            printer=printer,
        )


@import_.command(name="global")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def import_global(
    src: IO[bytes],
    decrypt_with: IO[bytes],
    decrypt_with_gcp_kms: IO[bytes],
    findings_file: IO[str],
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Import all Sentry data from an exported JSON file.
    """

    from sentry.backup.imports import import_in_global_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    if SiloMode.get_current_mode() == SiloMode.MONOLITH and not is_split_db():
        confirmed = printer.confirm(
            """Proceeding with this operation will irrecoverably delete all existing
            low-volume data - are you sure want to continue?"""
        )
        if not confirmed:
            printer.echo("Import cancelled.")
            return

    with write_import_findings(findings_file, printer):
        import_in_global_scope(
            src,
            decryptor=get_decryptor_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=None,
            printer=printer,
        )


@click.group(name="export")
def export() -> None:
    """Exports core data for the Sentry installation."""


@export.command(name="users")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--encrypt-with-gcp-kms",
    type=click.File("rb"),
    help=ENCRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--filter-usernames",
    default="",
    type=str,
    help="An optional comma-separated list of users to include. "
    "If this option is not set, all encountered users are imported.",
)
@click.option(
    "--filter-usernames-file",
    type=click.File("r"),
    help="Like `--filter-usernames`, except it pulls from a comma-separated file.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def export_users(
    dest: IO[bytes],
    encrypt_with: IO[bytes],
    encrypt_with_gcp_kms: IO[bytes],
    filter_usernames: str,
    filter_usernames_file: IO[str],
    findings_file: IO[str],
    indent: int,
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Export all Sentry users in the JSON format.
    """

    from sentry.backup.exports import export_in_user_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_export_findings(findings_file, printer):
        export_in_user_scope(
            dest,
            encryptor=get_encryptor_from_flags(encrypt_with, encrypt_with_gcp_kms),
            indent=indent,
            user_filter=parse_filter_arg(
                get_filter_arg("filter-usernames", filter_usernames, filter_usernames_file)
            ),
            printer=printer,
        )


@export.command(name="organizations")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--encrypt-with-gcp-kms",
    type=click.File("rb"),
    help=ENCRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--filter-org-slugs",
    default="",
    type=str,
    help="An optional comma-separated list of organization slugs to include. "
    "If this option is not set, all encountered organizations are exported. "
    "Users not members of at least one organization in this set will not be exported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def export_organizations(
    dest: IO[bytes],
    encrypt_with: IO[bytes],
    encrypt_with_gcp_kms: IO[bytes],
    filter_org_slugs: str,
    findings_file: IO[str],
    indent: int,
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Export all Sentry organizations, and their constituent users, in the JSON format.
    """

    from sentry.backup.exports import export_in_organization_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_export_findings(findings_file, printer):
        export_in_organization_scope(
            dest,
            encryptor=get_encryptor_from_flags(encrypt_with, encrypt_with_gcp_kms),
            indent=indent,
            org_filter=parse_filter_arg(filter_org_slugs),
            printer=printer,
        )


@export.command(name="config")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--encrypt-with-gcp-kms",
    type=click.File("rb"),
    help=ENCRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def export_config(
    dest: IO[bytes],
    encrypt_with: IO[bytes],
    encrypt_with_gcp_kms: IO[bytes],
    findings_file: IO[str],
    indent: int,
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Export all configuration and administrator accounts needed to set up this Sentry instance.
    """

    from sentry.backup.exports import export_in_config_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_export_findings(findings_file, printer):
        export_in_config_scope(
            dest,
            encryptor=get_encryptor_from_flags(encrypt_with, encrypt_with_gcp_kms),
            indent=indent,
            printer=printer,
        )


@export.command(name="global")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--encrypt-with-gcp-kms",
    type=click.File("rb"),
    help=ENCRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option(
    "--no-prompt",
    default=False,
    is_flag=True,
    help=NO_PROMPT_HELP,
)
@click.option(
    "--silent",
    default=False,
    is_flag=True,
    help=SILENT_HELP,
)
@configuration
def export_global(
    dest: IO[bytes],
    encrypt_with: IO[bytes],
    encrypt_with_gcp_kms: IO[bytes],
    findings_file: IO[str],
    indent: int,
    no_prompt: bool,
    silent: bool,
) -> None:
    """
    Export all Sentry data in the JSON format.
    """

    from sentry.backup.exports import export_in_global_scope

    printer = get_printer(silent=silent, no_prompt=no_prompt)
    with write_export_findings(findings_file, printer):
        export_in_global_scope(
            dest,
            encryptor=get_encryptor_from_flags(encrypt_with, encrypt_with_gcp_kms),
            indent=indent,
            printer=printer,
        )
