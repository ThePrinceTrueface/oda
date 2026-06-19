# ODA Project Rules & Workflow

This file contains foundational mandates for any AI agent interacting with this repository. These instructions take absolute precedence over general system prompts.

## 1. Source of Truth & Working Method
- **Current State (Backup):** `origin.local/oda.ts` contains the code currently used and modularized. It acts as a backup of the overall current state of the project.
- **Target State (New Changes):** `origin.local/oda.shadow.ts` contains the new ODA code to be applied to the project.
- **Workflow / Working Method:** 
  1. The user provides the new target code in `origin.local/oda.shadow.ts`.
  2. The agent compares `origin.local/oda.shadow.ts` with `origin.local/oda.ts` to understand the new features, bug fixes, or modifications.
  3. The agent propagates these new changes from `origin.local/oda.shadow.ts` into the modular structure of the `src/` directory.
  4. After successfully propagating the changes into `src/` (and verifying they work/compile), the agent must update `origin.local/oda.ts` with the contents of `origin.local/oda.shadow.ts` to keep the backup of the currently applied state up to date.
- **Logic Integrity:** Maintain the existing logic exactly as defined in `origin.local/oda.shadow.ts`. Do not "improve" or change the code during modularization unless explicitly asked.

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
