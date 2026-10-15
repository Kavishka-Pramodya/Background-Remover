import os
import zipfile

def build_zip(zip_path, files_map, include_backend=True):
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Include custom mapped files
        for src, arcname in files_map:
            if os.path.exists(src):
                zf.write(src, arcname=arcname)
            else:
                print(f"Warning: {src} not found!")

        # Include backend directory
        if include_backend:
            for root, dirs, files in os.walk("backend"):
                if "__pycache__" in root or ".pytest_cache" in root:
                    continue
                for file in files:
                    if file.endswith(".pyc"):
                        continue
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, ".")
                    zf.write(full_path, arcname=rel_path)

    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"Created {zip_path}: {size_mb:.2f} MB")

def create_all_bundles():
    downloads_dir = os.path.join("frontend", "downloads")

    # 1. Windows Bundle
    win_zip = os.path.join(downloads_dir, "Aura-Engine-Windows.zip")
    win_files = [
        ("requirements.txt", "requirements.txt"),
        (os.path.join(downloads_dir, "start_local_studio.bat"), "start_local_studio.bat"),
        (os.path.join(downloads_dir, "README_WINDOWS.txt"), "README.txt"),
    ]
    build_zip(win_zip, win_files)

    # 2. macOS Bundle
    mac_zip = os.path.join(downloads_dir, "Aura-Engine-macOS.zip")
    mac_files = [
        ("requirements.txt", "requirements.txt"),
        (os.path.join(downloads_dir, "start_local_studio.command"), "start_local_studio.command"),
        (os.path.join(downloads_dir, "start_local_studio.sh"), "start_local_studio.sh"),
        (os.path.join(downloads_dir, "README_MAC.txt"), "README.txt"),
    ]
    build_zip(mac_zip, mac_files)

    # 3. Universal / Legacy Bundle
    universal_zip = os.path.join(downloads_dir, "Aura-Local-AI-Studio.zip")
    universal_files = [
        ("requirements.txt", "requirements.txt"),
        (os.path.join(downloads_dir, "start_local_studio.bat"), "start_local_studio.bat"),
        (os.path.join(downloads_dir, "start_local_studio.command"), "start_local_studio.command"),
        (os.path.join(downloads_dir, "start_local_studio.sh"), "start_local_studio.sh"),
        (os.path.join(downloads_dir, "README_WINDOWS.txt"), "README_WINDOWS.txt"),
        (os.path.join(downloads_dir, "README_MAC.txt"), "README_MAC.txt"),
    ]
    build_zip(universal_zip, universal_files)

if __name__ == "__main__":
    create_all_bundles()
