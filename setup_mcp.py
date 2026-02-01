import os
import sys
import subprocess
import shutil
import json
import platform

def run_command(cmd):
    try:
        subprocess.check_call(cmd, shell=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        return False

def get_mcp_config_path():
    system = platform.system()
    if system == "Windows":
        return os.path.join(os.environ.get("APPDATA", ""), "Claude", "claude_desktop_config.json")
    elif system == "Darwin":  # macOS
        return os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")
    elif system == "Linux":
        return os.path.expanduser("~/.config/Claude/claude_desktop_config.json")
    return None

def main():
    print("=== NotebookLM MCP Universal Installer ===")
    
    # 1. Install package
    print("\n[1/3] Installing notebooklm-mcp-server...")
    if not run_command(f"{sys.executable} -m pip install -U notebooklm-mcp-server"):
        print("Failed to install via pip. Trying with --user...")
        if not run_command(f"{sys.executable} -m pip install --user -U notebooklm-mcp-server"):
            print("Critical failure: Could not install the server.")
            sys.exit(1)

    # 2. Find executable
    print("\n[2/3] Detecting executable paths...")
    server_exe = shutil.which("notebooklm-mcp")
    auth_exe = shutil.which("notebooklm-mcp-auth")

    if not server_exe:
        # Fallback for Windows user-base installs
        if platform.system() == "Windows":
            user_base = subprocess.check_output([sys.executable, "-m", "site", "--user-base"]).decode().strip()
            potential_path = os.path.join(user_base, "Scripts", "notebooklm-mcp.exe")
            if os.path.exists(potential_path):
                server_exe = potential_path
                auth_exe = os.path.join(user_base, "Scripts", "notebooklm-mcp-auth.exe")

    if not server_exe:
        print("Warning: Could not find 'notebooklm-mcp' in PATH.")
        print("Please ensure your Python scripts folder is in your PATH.")
        sys.exit(1)

    print(f"Found server: {server_exe}")
    print(f"Found auth: {auth_exe}")

    # 3. Generate Config Snippet
    print("\n[3/3] Configuration Snippet:")
    config_snippet = {
        "mcpServers": {
            "notebooklm": {
                "type": "stdio",
                "command": server_exe.replace("\\", "\\\\") if platform.system() == "Windows" else server_exe,
                "args": []
            }
        }
    }
    
    print(json.dumps(config_snippet, indent=2))
    
    config_path = get_mcp_config_path()
    print(f"\nRecommended config location: {config_path}")
    
    print("\n=== Next Steps ===")
    print(f"1. Run authentication: {auth_exe}")
    print("2. Add the JSON snippet above to your configuration file.")
    print("3. Restart your MCP client (Claude Desktop, Cursor, etc.)")

if __name__ == "__main__":
    main()
