#!/usr/bin/env python3
import json
import sys

version = sys.argv[1]
files = ["vss-extension.json", "package.json"]

for fname in files:
    with open(fname) as f:
        data = json.load(f)
    data["version"] = version
    with open(fname, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"  {fname} -> {version}")
