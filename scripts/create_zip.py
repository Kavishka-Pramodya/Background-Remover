import os
import zipfile

def create_bundle():
    zip_path = os.path.join("frontend", "downloads", "Aura-Local-AI-Studio.zip")
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. requirements.txt
        zf.write("requirements.txt", arcname="requirements.txt")
        # 2. start_local_studio.bat
        zf.write(os.path.join("frontend", "downloads", "start_local_studio.bat"), arcname="start_local_studio.bat")
        # 3. README_LOCAL_ENGINE.txt
        zf.write(os.path.join("frontend", "downloads", "README_LOCAL_ENGINE.txt"), arcname="README.txt")
        
        # 4. backend folder
        for root, dirs, files in os.walk("backend"):
            # skip pycache
            if "__pycache__" in root:
                continue
            for file in files:
                if file.endswith(".pyc"):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, ".")
                zf.write(full_path, arcname=rel_path)
                
    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"Created {zip_path}: {size_mb:.2f} MB")

if __name__ == "__main__":
    create_bundle()
