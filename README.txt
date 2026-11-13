Marker to SRT — v1.1.0 test build (based on user-tested v1.0.5 package)

This build preserves the supplied and user-tested marker-to-SRT implementation.
The marker export and caption-track import logic has not been changed.

Added:
- Scan Documents/Adobe/Common/Assets/Text Styles for .prtextstyle files.
- Display the available styles in a dropdown.
- Import the selected .prtextstyle into the currently open Premiere project.
- User manually applies the imported style to captions through Premiere's native Text/Properties panel.

No automatic style assignment. No direct project-file modification.

Install for testing:
1. Quit Premiere Pro.
2. Back up the current extension folder.
3. Extract this ZIP and replace the existing MarkerToSRT_Panel folder at:
   ~/Library/Application Support/Adobe/CEP/extensions/
4. Restart Premiere Pro and open Marker to SRT.

Test in a duplicate project before using it on production work.
