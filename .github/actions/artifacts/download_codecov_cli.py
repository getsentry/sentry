#!/usr/bin/env python3

import os
import subprocess
import urllib.request


def download_file(url, filename):
    chunk_size = 1024 * 1024  # 1 MB chunks
    with urllib.request.urlopen(url) as response:
        with open(filename, "wb") as out_file:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                out_file.write(chunk)


def run_command(command):
    # check true so if the command fails the entire script fails
    subprocess.run(command, check=True)


def main():
    key_url = "https://keybase.io/codecovsecurity/pgp_keys.asc"
    cli_url = "https://cli.codecov.io/latest/linux/codecov"
    sha256sum_url = "https://cli.codecov.io/latest/linux/codecov.SHA256SUM"
    sha256sig_url = "https://cli.codecov.io/latest/linux/codecov.SHA256SUM.sig"

    download_file(key_url, "pgp_keys.asc")
    run_command(
        ["gpg", "--no-default-keyring", "--keyring", "trustedkeys.gpg", "--import", "pgp_keys.asc"]
    )

    download_file(cli_url, "codecov")
    download_file(sha256sum_url, "codecov.SHA256SUM")
    download_file(sha256sig_url, "codecov.SHA256SUM.sig")
    run_command(["gpgv", "codecov.SHA256SUM.sig", "codecov.SHA256SUM"])
    run_command(["shasum", "-a", "256", "-c", "codecov.SHA256SUM"])
    os.chmod("codecov", 0o755)


if __name__ == "__main__":
    main()
