/**
 * RPC IDs for Google NotebookLM internal endpoints (batchexecute).
 * Discovered via reverse engineering.
 */
export const RPC_IDS = {
  LIST_NOTEBOOKS: "wXbhsf",
  CREATE_NOTEBOOK: "CCqFvf",
  GET_NOTEBOOK: "rLM1Ne",
  DELETE_NOTEBOOK: "WWINqb",
  RENAME_NOTEBOOK: "s0tc2d",
  
  ADD_SOURCE: "izAoDd",
  GET_SOURCE: "hizoJc",
  DELETE_SOURCE: "tGMBJ",
  SYNC_DRIVE_SOURCE: "FLmJqe",
  CHECK_FRESHNESS: "yR9Yof",
  
  QUERY: "Y0vGub", // RT=C Streaming
  
  START_FAST_RESEARCH: "Ljjv0c",
  START_DEEP_RESEARCH: "QA9ei",
  POLL_RESEARCH: "e3bVqc",
  IMPORT_RESEARCH: "LBwxtb",
  
  STUDIO_GENERATE: "R7cb6c",
  STUDIO_STATUS: "gArtLc",
  STUDIO_DELETE: "V5N4be",
  
  GENERATE_MIND_MAP: "yyryJe",
  SAVE_MIND_MAP: "CYK0Xb",
  LIST_MIND_MAPS: "cFji9",
  DELETE_MIND_MAP: "AH0mwd",
};

export const BASE_URL = "https://notebooklm.google.com";
export const BATCH_EXECUTE_PATH = "/_/NotebookLMApp/wob/v1/batchexecute";
export const QUERY_PATH = "/_/NotebookLMApp/rt/c";

export const DEFAULT_QUERY_TIMEOUT = 120000; // 120s
