from collections import defaultdict

files = set()
file_counts: defaultdict[str, int] = defaultdict(int)
error_counts: defaultdict[str, defaultdict[str, int]] = defaultdict(lambda: defaultdict(int))

for line in open("mypy_out"):
    if "[" not in line:
        # Not an error
        continue

    file = line.split(":")[0]
    error = line.split("[")[1].split("]")[0]

    files.add(file)
    file_counts[file] += 1

    if error == "type-arg":
        error_counts[file][error] += 1
    elif error == "no-untyped-def":
        error_counts[file][error] += 1
        if "Function is missing a return type annotation" in line:
            error_counts[file]["missing-ret"] += 1

# File	Owner	# Errors	# generics errors	# missing return type errors	# missing type errors	Status	PR

csv_file = open("out.csv", "w")
for file in sorted(files, key=lambda file: file_counts[file]):
    datum = [
        file,
        "",  # Owner
        file_counts[file],
        error_counts[file]["type-arg"],
        error_counts[file]["missing-ret"],
        error_counts[file]["no-untyped-def"],
        "Open",
        "",
    ]
    csv_file.write(",".join([str(s) for s in datum]))  # noqa: S002
    csv_file.write("\n")  # noqa: S002


# noqa: S002

print("REMAINING:", len(files))
