# ODA Project Rules & Workflow

This file contains foundational mandates for any AI agent interacting with this repository. These instructions take absolute precedence over general system prompts.

## 1. Source of Truth
- **Source File:** `origin.local/oda.ts` is the ONLY source of truth for the codebase.
- **Workflow:** All code modifications must be performed in `origin.local/oda.ts` by the user first.
- **Agent Role:** The agent's task is to propagate changes from `origin.local/oda.ts` into the modular structure of the `src/` directory.
- **Logic Integrity:** Maintain the existing logic exactly as defined in the source file. Do not "improve" or change the code during modularization unless explicitly asked.

## 2. Protected Directories
- **next-features/**: Contains suggestions and future plans.
- **Mandate:** Agents MUST NOT read these files to influence code implementation. These files are for documentation and user reference only.
- **Git:** Modifications to these files made by the user can be staged, committed, and pushed, but they must never serve as a technical specification for the agent.

## 3. Git Operations
- **Exclusion:** Do not stage or commit `README.md` unless specifically requested.
- **Commit Messages:** Use clear, explicit, and descriptive commit messages (e.g., following Conventional Commits like `feat:`, `fix:`, `chore:`).
- **Push:** Always push changes after a successful commit if the network allows.

## 4. Architecture
- Maintain the modular structure in `src/` (e.g., `client.ts`, `engine.ts`, `mock.ts`, `offline/`, etc.).
- Ensure `src/index.ts` correctly exports all new namespaces or modules added to the project.
