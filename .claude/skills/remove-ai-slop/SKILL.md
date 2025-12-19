---
name: remove-ai-code-slop
description: Removes slop code and comments that AI often makes. Run when done editing a file or before committing.
---

# Remove AI code slop

Check the diff against master, and remove all AI generated slop introduced in this branch.

This includes:

- Extra comments that a human wouldn't add or is inconsistent with the rest of the file
- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase (especially if called by trusted / validated codepaths)
- Any other style that is inconsistent with the file
