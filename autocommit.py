#!/usr/bin/env python3
import os
import re
import subprocess

FILES_TO_UPDATE = [
    ".github/workflows/scripts/calculate-backend-test-shards.py",
    ".github/workflows/backend.yml"
]

SELECTED_TESTS_PATTERN = "selected-tests-"

SHA_REGEX = re.compile(r"\b[0-9a-f]{40}\b")  # 40-char hex SHA


def get_selected_test_files():
    return [f for f in os.listdir(".") if f.startswith(SELECTED_TESTS_PATTERN)]


def find_old_sha(file_path):
    """Return the first 40-char hex SHA found in the file, or None."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    match = SHA_REGEX.search(content)
    return match.group(0) if match else None


def replace_sha_in_file(file_path, old_sha, new_sha):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = content.replace(old_sha, new_sha)
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    return False


def git_commit(files, message):
    subprocess.run(["git", "add"] + files, check=True)
    subprocess.run(["git", "commit", "-nm", message], check=True)


def main():
    selected_files = get_selected_test_files()
    if not selected_files:
        print("No selected-tests-* files found in current directory.")
        return

    for file_name in selected_files:
        new_sha_match = re.match(r"selected-tests-(\w+)", file_name)
        if not new_sha_match:
            continue
        new_sha = new_sha_match.group(1)
        print(f"Processing {file_name}, replacing with SHA: {new_sha}")

        # Find old SHA from first target file
        old_sha = find_old_sha(FILES_TO_UPDATE[0])
        if not old_sha:
            print(f"No SHA found in {FILES_TO_UPDATE[0]} to replace.")
            continue
        print(f"Found old SHA: {old_sha}")

        changed_files = []
        for target_file in FILES_TO_UPDATE:
            if replace_sha_in_file(target_file, old_sha, new_sha):
                print(f"Updated {target_file}")
                changed_files.append(target_file)

        if changed_files:
            commit_msg = f"selected-tests-{new_sha}"
            git_commit(changed_files, commit_msg)
            print(f"Committed changes: {commit_msg}")
        else:
            print("No changes made for this SHA.")


if __name__ == "__main__":
    main()
