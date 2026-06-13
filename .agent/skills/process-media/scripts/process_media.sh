#!/bin/bash

# Combined Media Processing Script
# Combines logic from: resize_images.sh, sanitize_filenames.py, sanitize_folders.py

# Default values
SOURCE_DIR="."
TARGET_DIR="."
DRY_RUN=false
EXECUTE_FLAG=""

# Function to display help
show_help() {
    echo "Usage: $0 [source_dir] [target_dir] [--dry-run]"
    echo ""
    echo "Arguments:"
    echo "  source_dir   Directory to sanitize and process (default: current)"
    echo "  target_dir   Directory where optimized images will be saved (default: current)"
    echo "  --dry-run    Show proposed changes without applying them"
    echo ""
}

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) show_help; exit 0 ;;
        *)
            if [ -z "$POS_SOURCE" ]; then
                POS_SOURCE="$1"
            elif [ -z "$POS_TARGET" ]; then
                POS_TARGET="$1"
            else
                echo "Unknown argument: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

SOURCE_DIR="${POS_SOURCE:-$SOURCE_DIR}"
TARGET_DIR="${POS_TARGET:-$TARGET_DIR}"

if [ "$DRY_RUN" = false ]; then
    EXECUTE_FLAG="--execute"
fi

echo "🚀 Starting Media Processing"
echo "📂 Source: $SOURCE_DIR"
echo "📂 Target: $TARGET_DIR"
echo "🔍 Dry Run: $DRY_RUN"
echo ""

# Check for ImageMagick
if ! command -v magick &> /dev/null; then
    echo "❌ Error: 'magick' (ImageMagick 7+) is not installed."
    exit 1
fi

# Step 1: Recursive Sanitization of Folders and Filenames
echo "🧹 Step 1: Sanitizing folders and filenames..."

# Embedded Python for complex sanitization logic
python3 - <<EOF
import os, re, sys, unicodedata

def sanitize_base(name):
    # Remove diacritics
    name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
    name = name.lower()
    # Remove special characters
    name = re.sub(r'[^a-z0-9\s_-]', '', name)
    # Replace spaces and underscores with hyphens
    name = re.sub(r'[\s_]+', '-', name)
    return name.strip('-')

def sanitize_filename(filename):
    base, ext = os.path.splitext(filename)
    # Remove leading year/order prefix (e.g. 2022_10_)
    base = re.sub(r'^\d{4}[_\s](?:\d+[_\s]+)?', '', base)
    return sanitize_base(base) + ext.lower()

def parse_folder(name):
    year_match = re.search(r'^(\d{4})', name)
    year = year_match.group(1) if year_match else "2026"
    base_name = re.sub(r'^\d{4}[_\s-]*(?:\d+[_\s-]*)?', '', name)
    prefix_part = name[:len(name) - len(base_name)]
    number_match = re.search(r'^\d{4}[_\s-]*(\d+)', prefix_part)
    number = int(number_match.group(1)) if number_match else None
    return year, number, sanitize_base(base_name)

def process_recursive(root_dir, dry_run=True):
    if not os.path.exists(root_dir):
        print(f"Error: {root_dir} does not exist.")
        return

    # We walk top-down to easily handle numbering among siblings, 
    # but we must be careful with recursion if we rename the directory we are in.
    
    def walk_and_process(current_path):
        try:
            items = os.listdir(current_path)
        except PermissionError:
            return

        files = [i for i in items if os.path.isfile(os.path.join(current_path, i))]
        dirs = [i for i in items if os.path.isdir(os.path.join(current_path, i))]

        # 1. Rename files in current_path
        seen_files = {} # new_name -> old_name
        for f in files:
            if f.startswith('.'): continue
            new_f = sanitize_filename(f)
            
            # handle collisions
            orig_new_f = new_f
            b, e = os.path.splitext(new_f)
            c = 1
            while new_f in seen_files or (new_f != f and os.path.exists(os.path.join(current_path, new_f))):
                new_f = f"{b}-{c}{e}"
                c += 1
            
            seen_files[new_f] = f
            if f != new_f:
                old_p = os.path.join(current_path, f)
                new_p = os.path.join(current_path, new_f)
                print(f"  [FILE] '{f}' -> '{new_f}'")
                if not dry_run: os.rename(old_p, new_p)

        # 2. Rename directories in current_path
        if dirs:
            used_numbers = {} # year -> set
            parsed = []
            for d in dirs:
                y, n, b = parse_folder(d)
                parsed.append({'orig': d, 'y': y, 'n': n, 'b': b})
                if y not in used_numbers: used_numbers[y] = set()
                if n is not None: used_numbers[y].add(n)
            
            parsed.sort(key=lambda x: x['orig'])
            
            renamed_dirs = []
            seen_new_dirs = set()
            for entry in parsed:
                y, n, b = entry['y'], entry['n'], entry['b']
                if n is None:
                    n = 1
                    while n in used_numbers[y]: n += 1
                    used_numbers[y].add(n)
                
                new_d = f"{y}-{n:02d}-{b}"
                
                # handle collisions
                orig_new_d = new_d
                c = 1
                while new_d in seen_new_dirs or (new_d != entry['orig'] and os.path.exists(os.path.join(current_path, new_d))):
                    new_d = f"{orig_new_d}-{c}"
                    c += 1
                
                seen_new_dirs.add(new_d)
                
                old_p = os.path.join(current_path, entry['orig'])
                new_p = os.path.join(current_path, new_d)
                
                if entry['orig'] != new_d:
                    print(f"  [DIR]  '{entry['orig']}' -> '{new_d}'")
                    if not dry_run: os.rename(old_p, new_p)
                    renamed_dirs.append(new_d)
                else:
                    renamed_dirs.append(entry['orig'])
            
            # 3. Recurse into subdirectories
            for entry, new_d in zip(parsed, renamed_dirs):
                # Recurse into the directory. 
                # If dry_run, use original name. If not, use new name.
                recurse_name = entry['orig'] if dry_run else new_d
                walk_and_process(os.path.join(current_path, recurse_name))

    walk_and_process(root_dir)

source = "$SOURCE_DIR"
dry = "$DRY_RUN" == "true"
process_recursive(source, dry_run=dry)
EOF

echo ""
echo "🖼️ Step 2: Optimizing and resizing images..."

# Configuration from resize_images.sh
SIZES=(400 800 1200)
QUALITY=75

# We use a small python snippet to get the sanitized path for the target 
# to ensure it matches the projected sanitization even in dry-run.
sanitize_path() {
    python3 -c "
import os, re, unicodedata
def s(n):
    n = unicodedata.normalize('NFKD', n).encode('ASCII', 'ignore').decode('ASCII').lower()
    return re.sub(r'[^a-z0-9\s_-]', '', n).replace(' ', '-').replace('_', '-').strip('-')
def sf(f):
    b, e = os.path.splitext(f)
    b = re.sub(r'^\d{4}[_\s](?:\d+[_\s]+)?', '', b)
    return s(b) + e.lower()
def sp(p):
    parts = p.split('/')
    res = []
    for part in parts:
        if not part: continue
        # folder logic
        y_m = re.search(r'^(\d{4})', part)
        y = y_m.group(1) if y_m else None
        if y:
            b = re.sub(r'^\d{4}[_\s-]*(?:\d+[_\s-]*)?', '', part)
            # we don't know the exact number assigned in earlier step without full state, 
            # but we can approximate or just use the base for the preview.
            # For simplicity in this helper, we just sanitize the whole part if it doesn't look like YYYY-NN-
            if not re.match(r'^\d{4}-\d{2}-', part):
                 res.append(s(part))
            else:
                 res.append(part.lower())
        else:
            res.append(sf(part) if '.' in part else s(part))
    return '/'.join(res)
print(sp('$1'))
"
}

# Find all images in the source directory
find "$SOURCE_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" -o -iname "*.avif" \) | while read -r img; do
    
    # Path relative to source
    relative_path="${img#$SOURCE_DIR/}"
    
    # Calculate sanitized relative path for target
    # This ensures consistency even if we haven't renamed source yet.
    san_relative_path=$(sanitize_path "$relative_path")
    
    rel_dir=$(dirname "$san_relative_path")
    filename=$(basename -- "$san_relative_path")
    filename_noext="${filename%.*}"

    # Ignore already generated variants
    if [[ "$filename_noext" =~ -[0-9]+w$ ]]; then
        continue
    fi

    target_subdir="$TARGET_DIR/$rel_dir"
    [ "$rel_dir" = "." ] && target_subdir="$TARGET_DIR"

    if [ "$DRY_RUN" = false ]; then
        mkdir -p "$target_subdir"
    fi

    echo "📦 Processing: $relative_path -> $san_relative_path"

    for size in "${SIZES[@]}"; do
        webp_target="$target_subdir/${filename_noext}-${size}w.webp"
        avif_target="$target_subdir/${filename_noext}-${size}w.avif"

        if [ "$DRY_RUN" = true ]; then
            echo "  [DRY] magick \"$img\" -resize ${size}x -quality $QUALITY -strip \"$webp_target\""
            echo "  [DRY] magick \"$img\" -resize ${size}x -quality $QUALITY -strip \"$avif_target\""
        else
            magick "$img" -resize "${size}x" -quality "$QUALITY" -strip "$webp_target"
            magick "$img" -resize "${size}x" -quality "$QUALITY" -strip "$avif_target"
        fi
    done
done

echo ""
echo "✅ Finished media processing!"
