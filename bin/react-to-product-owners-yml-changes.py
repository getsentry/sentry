#!/usr/bin/env python3

import os, sys, yaml
from os.path import realpath, join, dirname

# Run from project root.
os.chdir(realpath(join(dirname(sys.argv[0]), '..')))

PREFIX = 'Product Area: '
LABELS_YAML = '.github/labels.yml'

product_owners = yaml.safe_load(open(sys.argv[1]))
labels = open(LABELS_YAML)

fastforward = False
head = []
product_areas = ["- name: 'Product Area: Unknown'\n", "  color: '8D5494'\n"]
tail = []
current = head

# Best to look the other way, Buck. This is just waaaay easier than trying to
# use ruamel.yaml to preserve comments and other formatting.

for line in labels:
    if line == '\n':
        fastforward = False
    elif fastforward:
        continue
    elif line.startswith("- name: 'Product Area: "):
        fastforward = True
        current = tail
        continue
    current.append(line)

for area in product_owners['by_area']:
    if "'" in area:
        product_areas.append(f'- name: "Product Area: {area}"\n')
    else:
        product_areas.append(f"- name: 'Product Area: {area}'\n")
    product_areas.append(f"  color: '8D5494'\n")

product_areas += ["- name: 'Product Area: Other'\n", "  color: '8D5494'\n"]

with open('.github/labels.yml', 'w+') as fp:
    fp.writelines(head)
    fp.writelines(product_areas)
    fp.writelines(tail)


# TODO: issue templates, bug and feature
