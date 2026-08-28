#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path


def slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ValueError("context-name must contain at least one letter or digit")
    return slug


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Write a handoff markdown file into the user's temp directory."
    )
    parser.add_argument("--context-name", required=True, help="Name stem used in the output filename")
    args = parser.parse_args()

    content = sys.stdin.read()
    if not content.strip():
        raise ValueError("stdin content is empty")

    context_name = slugify(args.context_name)
    tmpdir = Path(os.environ.get("TMPDIR") or "/tmp")
    output_path = tmpdir / f"handoff-{context_name}.md"
    output_path.write_text(content, encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
