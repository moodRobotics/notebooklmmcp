# Tools Reference

This document describes the tools provided by the `notebook-mcp-server`.

## Notebook Management

### `notebook_list`
Lists all notebooks in the user's account.
- **Parameters**: None
- **Return**: A list of notebook objects (title, ID, creation time).

### `notebook_create`
Creates a new empty notebook.
- **Parameters**: 
  - `title` (string): The title of the notebook.
  - `description` (optional string): A brief description.

### `notebook_delete`
Deletes a notebook by its ID.
- **Parameters**: 
  - `notebook_id` (string): The UUID of the notebook.

## Source Management

### `notebook_add_url`
Add a website or YouTube video as a source.
- **Parameters**:
  - `notebook_id` (string)
  - `url` (string)

### `notebook_add_text`
Add direct text content as a source.
- **Parameters**:
  - `notebook_id` (string)
  - `title` (string)
  - `content` (string)

### `notebook_add_local_file`
Read a local file from your system and add it as a source.
- **Parameters**:
  - `notebook_id` (string)
  - `path` (string): Absolute path to the file (Supports .pdf, .txt, .md).

### `notebook_add_drive`
Add a file from Google Drive (Docs, Slides, etc.) as a source.
- **Parameters**:
  - `notebook_id` (string)
  - `file_id` (string): The Google Drive File ID.

### `source_delete`
Remove a source from a notebook.
- **Parameters**:
  - `notebook_id` (string)
  - `source_id` (string)

### `source_sync`
Force a synchronization of a Google Drive source to fetch the latest version.
- **Parameters**:
  - `notebook_id` (string)
  - `source_id` (string)

## Queries & AI

### `notebook_query`
Ask questions about the notebook's sources.
- **Parameters**:
  - `notebook_id` (string)
  - `query` (string)
  - `conversation_id` (optional string): To continue a previous chat.

### `research_start`
Start a research task using external sources.
- **Parameters**:
  - `notebook_id` (string)
  - `query` (string)
  - `source` (enum: "web", "drive"): Where to search.
  - `mode` (enum: "fast", "deep"): Level of research.

### `research_poll`
Check for research results and progress.
- **Parameters**:
  - `notebook_id` (string)

### `research_import`
Import selected sources from a research task into the notebook as permanent sources.
- **Parameters**:
  - `notebook_id` (string)
  - `task_id` (string): The research task ID.
  - `sources` (array): The list of sources to import (obtained from `research_poll`).

## Mind Maps

### `mind_map_generate`
Generate a Mind Map JSON structure from notebook sources.
- **Parameters**:
  - `source_ids` (array of strings): Sources to include in the map.

### `mind_map_save`
Save a generated mind map to the notebook's Studio.
- **Parameters**:
  - `notebook_id` (string)
  - `mind_map_json` (string): The JSON from `mind_map_generate`.
  - `source_ids` (array of strings): Sources used for the map.
  - `title` (string, optional): Title for the mind map.

### `mind_map_list`
List all saved mind maps in a notebook.
- **Parameters**:
  - `notebook_id` (string)

### `mind_map_delete`
Permanently delete a mind map.
- **Parameters**:
  - `notebook_id` (string)
  - `mind_map_id` (string)

## Studio Content

### `audio_overview_create`
Generate a deep-dive audio overview (podcast style) for the notebook.
- **Parameters**:
  - `notebook_id` (string)
  - `source_ids` (array of strings, optional): Specific sources to include.
  - `language` (string, optional): Language code (default: "en").

### `studio_poll`
Check the status of generated studio artifacts (Audio Overviews, etc.) and get download URLs.
- **Parameters**:
  - `notebook_id` (string)
