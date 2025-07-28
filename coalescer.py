# flake8: noqa: S002


# Output of: mypy <DIR>
mypy_output_filename = "files_with_errors.txt"

files_with_errors = set()
with open(mypy_output_filename) as mypy_output:
    for error_line in mypy_output:
        f = error_line.split(":")[0]
        files_with_errors.add(f)

print("# files with errors:", len(files_with_errors))

# Output of: find <DIR>
find_output_filename = "all_files.txt"

good_files_and_dirs = set()
with open(find_output_filename) as find_output:
    for cand in find_output:
        cand = cand.strip()

        if "__" in cand:
            continue

        if "." in cand:
            if not cand.endswith(".py"):
                # Neither .py nor directory. skipit.
                continue
        else:
            # Directory. add trailing slash.
            cand = cand + "/"

        is_good = True
        for bad in files_with_errors:
            if bad.startswith(cand):
                is_good = False
                break

        if is_good:
            good_files_and_dirs.add(cand)

print("good # files/directories:", len(good_files_and_dirs))

coalesced: set[str] = set()
for cand in sorted(good_files_and_dirs, key=len):
    new = True
    for other in coalesced:
        if cand.startswith(other):
            new = False
            break

    if new:
        coalesced.add(cand)

print("# coalesced:", len(coalesced))

for good_f in sorted(coalesced):
    good_f = good_f.replace(".py", "").replace("/", ".")
    if good_f[-1] == ".":
        good_f = good_f + "*"
    good_f = '"' + good_f + '",'
    print(good_f)
