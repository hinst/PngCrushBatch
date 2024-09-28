Compress all files in a directory and remember which files are already compressed to avoid re-compressing them when running incrementally.

Tests:
* **2024.09.28** Compressing folder with images saved from the AMD Amuse app
    * Before:
        * Folder size: 712 MB
        * File count: 536
    * After:
        * Folder size: 576 MB
        * File count: 536
    * Size reduction: 20%
