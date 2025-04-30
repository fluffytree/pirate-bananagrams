"""Deploy the bananagrams website on Modal.

```
npm run build
modal deploy app.py
```
"""

import subprocess
import modal


app = modal.App("pirate-bananagrams")
app.image = (
    modal.Image.from_registry("node:22-slim", add_python="3.13")
    .env({"NODE_ENV": "production"})
    .add_local_file("package.json", "/app/package.json", copy=True)
    .add_local_file("package-lock.json", "/app/package-lock.json", copy=True)
    .run_commands("npm ci --prefix /app")
    .add_local_dir("dist-server", "/app/dist-server")
    .add_local_dir("dist", "/app/dist")
)


@app.function(
    min_containers=1,
    max_containers=1,
    allow_concurrent_inputs=1000,
    timeout=3600,
)
@modal.web_server(port=3000)
def web():
    subprocess.Popen(["node", "dist-server/index.js"], cwd="/app")
