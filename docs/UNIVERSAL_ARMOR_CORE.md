![Universal Armor](https://github.com/TheCascadian/Universal-Armor/blob/main/universalarmor3.png)
<!-- PLACEHOLDER: Replace banner image with glitch/distorted armor banner -->

Craft armor out of ***(nearly) anything*** in the game. Dirt chestplates. Diamond ore boots. Compressed obsidian leggings if you are running Universal Compression alongside this.

***

## Project Stats

[![Stars](https://img.shields.io/github/stars/TheCascadian/Universal-Armor)](https://github.com/TheCascadian/Universal-Armor/stargazers)
[![Watchers](https://img.shields.io/github/watchers/TheCascadian/Universal-Armor)](https://github.com/TheCascadian/Universal-Armor/watchers)
[![Forks](https://img.shields.io/github/forks/TheCascadian/Universal-Armor)](https://github.com/TheCascadian/Universal-Armor/network/members)
[![Open Issues](https://img.shields.io/github/issues/TheCascadian/Universal-Armor)](https://github.com/TheCascadian/Universal-Armor/issues)
![Total Commits](https://img.shields.io/badge/Commits-0-blue) <!-- TOTAL_COMMITS: 0 -->
![Lines of Code](https://img.shields.io/badge/Lines_of_Code-0-blue) <!-- LINES_OF_CODE: 0 -->
![Monthly Downloads](https://img.shields.io/badge/Monthly_Downloads-0-success) <!-- MONTHLY_DOWNLOADS: 0 -->

***

## What It Does

Universal Armor generates full armor sets (helmet, chestplate, leggings, boots) for nearly every item and block in your instance. Same crafting recipes as vanilla armor. Same durability scaling logic. Just more.

*   **No upfront configuration required.** Every block and item from every installed mod is supported automatically at startup.
*   **Vanilla recipe parity.** If you know how to craft iron armor, you already know how to craft this.
*   **Compressed armor tiers.** If Universal Compression is active, compressed blocks can be smithed into progressively denser armor sets. Requires both mods installed; compressed armor does not exist otherwise.
*   **Runtime recipe generation.** No datapack bloat. No manual JSON wrangling. Recipes are built virtually at startup.

Requires NeoForge 1.21+. MIT licensed.

***

## Compatibility

| Mod | Status | Note |
|---|---|---|
| ATM10 | Tested | Built and verified against All the Mods 10 |
| Universal Compression | Optional | Required for compressed block armor tiers |
| Other mods | Automatic | Any item or block from any mod is eligible unless stated otherwise |

***

## Also from Me!

| Project | Platform | Downloads |
|---|---|---|
| [Universal Compression](https://github.com/TheCascadian/Universal-Compression) | [Modrinth](https://modrinth.com/mod/universal-compression) | 255 |
| [Universal Compression](https://github.com/TheCascadian/Universal-Compression) | [CurseForge](https://www.curseforge.com/minecraft/mc-mods/universal-compression) | 40+ |
| [HOI4 Focus GUI](https://github.com/TheCascadian/HOI4FocusGUI) | GitHub | 6 |

> Download counts for Universal Compression are pulled from live Modrinth and CurseForge figures. Numbers shown are current as of the last update.

***

## Installation

1. Install NeoForge 1.21+ for your instance.
2. Drop `universalarmor-<version>.jar` into your `mods` folder.
3. Launch. Recipes generate automatically. No restart required for most additions.

***

## Building From Source

```bash
git clone [https://github.com/TheCascadian/Universal-Armor.git](https://github.com/TheCascadian/Universal-Armor.git)
cd Universal-Armor
./gradlew build
