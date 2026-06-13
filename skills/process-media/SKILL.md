---
name: process-media
description: Automate media processing, including recursive sanitization of folders and filenames, and image optimization (WebP/AVIF resizing). This skill is essential when preparing raw project assets for the website to ensure consistent naming conventions and optimized delivery.
---

This skill provides a comprehensive way to manage and optimize media assets for the static web template. It combines filename/folder sanitization with image conversion and resizing.

## Core Capabilities

- **Recursive Sanitization**: Recursively cleans folder and filenames.
  - **Folders**: Follows the `YYYY-NN-name` pattern.
  - **Files**: Slugifies filenames, removes diacritics, and handles prefixes.
- **Image Optimization**: Generates WebP and AVIF versions in multiple widths (400, 800, 1200 pixels).
- **Dry-Run Preview**: Safely preview all changes before applying them.

## Usage Guide

The skill is built around the `process_media` command, which is available globally in your terminal. You can also find the source script in `scripts/process_media.sh`.

### Command Arguments

- `source_dir`: (Optional) The directory to process. Defaults to current directory.
- `target_dir`: (Optional) The directory to output optimized images. Defaults to current directory.
- `--dry-run`: (Recommended) Shows proposed renames and ImageMagick commands without executing them.

### Common Workflow

1.  **Place raw assets**: Add new project folders/images to a temporary or source directory.
2.  **Preview**: Run with `--dry-run` to verify naming and output structure.
    ```bash
    process_media path/to/source path/to/output --dry-run
    ```
3.  **Process**: Run without `--dry-run` to sanitize the source and generate optimized assets.
    ```bash
    process_media path/to/source path/to/output
    ```

## Implementation Details

- **Language**: Bash wrapper with embedded Python 3 for complex string manipulation.
- **Dependencies**: Requires `magick` (ImageMagick 7+) and `python3`.
- **Naming Logic**:
  - Extracts year from the start of names or defaults to 2026.
  - Slugifies names (removes diacritics, lowercase, removes special chars, hyphens for spaces).
  - Handles name collisions by appending counters.
