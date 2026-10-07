![GitHub stars](https://img.shields.io/github/stars/TheCascadian/Universal-Ore-Processing?style=flat-square)
![GitHub watchers](https://img.shields.io/github/watchers/TheCascadian/Universal-Ore-Processing?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/TheCascadian/Universal-Ore-Processing?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/TheCascadian/Universal-Ore-Processing?style=flat-square)
![Minecraft](https://img.shields.io/badge/Minecraft-1.21.1-62b47a?style=flat-square)
![NeoForge](https://img.shields.io/badge/NeoForge-21.1.219-e68c2f?style=flat-square)
![Java](https://img.shields.io/badge/Java-21-5382a1?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
[![Discord](https://img.shields.io/discord/1201161505442381884?label=Discord&logo=discord&style=flat-square)](https://discord.com/invite/RuaR7CBy7Z)

# Universal Ore Processing

Crush, wash and smelt (nearly) _any_ ore in the game through one shared processing chain, **no matter which mod added it**.

***

## What It Does

Universal Ore Processing scans the common item tags at startup, works out which ores your instance actually contains, and lets three machines process all of them. The mod registers a small fixed set of generic items. The material an item belongs to (iron, tin, certus quartz and so on) is stored on the item itself, so its name, tint and output all follow from that.

*   **No upfront configuration required.** Every ore from every installed mod that follows the common tag conventions is supported automatically.
*   **Three stages, three machines.** Ore Crusher, Ore Washer and Ore Smelter turn ore into Crushed Ore, Purified Ore and finally the material's ingot, gem or dust.
*   **No per-material registration.** The same three items serve every material, and their names and colors are derived from the material they carry.
*   **No datapack bloat.** Crushing and washing are each a single dynamic recipe evaluated at craft time, so no recipe JSON is generated per ore.
*   **Reload safe.** Discovery reruns after every datapack reload and the result is swapped in atomically, so machines always see a consistent view.
*   **Fuel or power.** Machines burn fuel by default. A config switch moves them to Forge Energy.

Requires NeoForge 1.21.1. MIT licensed.

***

## The Processing Chain

```
Ore or raw material  ->  Ore Crusher  ->  Crushed Ore
Crushed Ore + water  ->  Ore Washer   ->  Purified Ore
Purified Ore or Dust ->  Ore Smelter  ->  Ingot, gem or dust of the material
```

| Stage | Machine | Input | Output | Default yield |
|---|---|---|---|---|
| Crush | Ore Crusher | Any item in `c:ores/*` | Crushed Ore | 2 per ore |
| Crush | Ore Crusher | Any item in `c:raw_materials/*` | Crushed Ore | 1 per raw item |
| Wash | Ore Washer | Crushed Ore and water | Purified Ore | 1 per Crushed Ore |
| Smelt | Ore Smelter | Purified Ore or Material Dust | Resolved output item | 1 per input |

Every yield has its own multiplier in the config. The whole part of the result is guaranteed and the fractional part is the chance of one extra item, with a minimum of one.

***

## Machines

| Machine | Crafting pattern | Notes |
|---|---|---|
| Ore Crusher | Flint, cobblestone and a furnace | Accepts any ore or raw material the registry knows |
| Ore Washer | Iron ingots, a bucket, cobblestone and a furnace | 4000 mB internal tank. Right-click with a water bucket or pipe water in. Uses 250 mB per operation by default |
| Ore Smelter | Iron ingots, cobblestone and a blast furnace | Runs at blast furnace speed by default. Set `smelter_ticks` to 200 for furnace speed |

Every machine has an input, output and fuel slot, a progress arrow, and a power display. Hoppers and pipes work through the standard item handler: the top face accepts input, the bottom face is the output, and the sides accept fuel. The Ore Washer also exposes a fluid handler, and all machines expose an energy handler when `use_energy` is enabled.

***

## How Materials Are Chosen

A material is processable when all of the following hold:

1. It has at least one entry in `c:ores/<material>` or `c:raw_materials/<material>`.
2. It has at least one resolvable output. The mod tries `c:ingots/<material>`, then `c:gems/<material>`, then `c:dusts/<material>` (the order is configurable). If none of those exist, it falls back to a registry item named after the material, which is how coal resolves to `minecraft:coal`.
3. It passes the exclusion rules in the config and is not tagged `universaloreprocessing:non_processable`.

When several items qualify as the output, namespaces listed in `namespace_priority` win in order (default `minecraft`), and the rest are sorted alphabetically. Clients rebuild the same registry from the synced tags, so no custom network payload is needed.

***

## Configuration

The config file is generated at `<instance>/config/universaloreprocessing-common.toml`. Every option is commented in the file.

For a standard install of the Minecraft Launcher:
1. Keybind: Windows+R (this opens a small menu at the bottom of your screen)
2. Type `%appdata%` in the input box, then press Enter
3. Locate the `.minecraft` folder near the top
4. Navigate to your `config` folder from there

<details>
<summary>Filtering and resolution</summary>

| Option | Default | Purpose |
|---|---|---|
| `excluded_materials` | empty | Material ids that are never processed, for example `certus_quartz` |
| `excluded_mods` | empty | Mod ids whose items are never used as inputs or outputs |
| `blacklist_namespaces_exact` | empty | Namespaces excluded by exact match |
| `blacklist_namespaces_contains` | empty | Namespaces excluded when they contain the string (case-sensitive) |
| `blacklist_namespaces_starts` | empty | Namespaces excluded when they start with the prefix |
| `blacklist_paths_contains` | empty | Item path substrings that trigger an exclusion |
| `output_preference` | `ingot`, `gem`, `dust` | Order in which output kinds are tried |
| `namespace_priority` | `minecraft` | Namespaces preferred when several outputs qualify |

</details>

<details>
<summary>Stages, yields and timing</summary>

| Option | Default | Purpose |
|---|---|---|
| `crush_enabled` | `true` | Enables the Ore Crusher stage |
| `wash_enabled` | `true` | Enables the Ore Washer stage |
| `smelt_enabled` | `true` | Enables the Ore Smelter stage |
| `crushed_per_ore` | `2` | Crushed Ore per ore item |
| `crushed_per_raw` | `1` | Crushed Ore per raw material item |
| `crusher_yield_multiplier` | `1.0` | Multiplier on crusher output |
| `washer_yield_multiplier` | `1.0` | Multiplier on washer output |
| `smelter_yield_multiplier` | `1.0` | Yield bonus on smelter output |
| `crusher_ticks` | `100` | Ticks per crusher operation |
| `washer_ticks` | `100` | Ticks per washer operation |
| `smelter_ticks` | `100` | Ticks per smelter operation |
| `washer_water_per_operation` | `250` | Millibuckets of water per wash |

</details>

<details>
<summary>Power</summary>

| Option | Default | Purpose |
|---|---|---|
| `use_energy` | `false` | Machines consume FE instead of fuel items |
| `energy_per_tick` | `20` | FE consumed per tick of work |
| `energy_capacity` | `20000` | FE buffer of each machine |

</details>

To exclude a specific item from processing without editing the config, add it to the item tag `universaloreprocessing:non_processable` from a datapack. Items in that tag are ignored as both inputs and outputs.

***

## Commands

All commands require permission level 2.

| Command | Effect |
|---|---|
| `/uop dump` | Prints the discovered materials, the resolved output for each, and the dynamic recipe counts. The full report is written to `logs/uop_dump.txt` |
| `/uop give <material> <stage>` | Gives one item of the chosen stage for testing. Stage is `crushed`, `purified` or `dust` |

***

## Compatibility

| Mod | Status | Note |
|---|---|---|
| JEI | Optional | Shows the crush, wash and smelt results per material when present. Never a hard dependency |
| Universal Compression | Independent | Part of the same series. No interaction |
| Universal Armor | Independent | Part of the same series. No interaction |
| Other mods | Automatic | Any ore tagged with the common `c:ores/*` and `c:raw_materials/*` conventions is picked up |

Ores that use non-standard tags are not discovered. Add them to the matching `c:` tag from a datapack if you need them supported.

***

## Also from Me!

| Project | Platform |
|---|---|
| [Universal Compression](https://github.com/TheCascadian/Universal-Compression) | [Modrinth](https://modrinth.com/mod/universal-compression) and [CurseForge](https://www.curseforge.com/minecraft/mc-mods/universal-compression) |
| [Universal Armor](https://github.com/TheCascadian/Universal-Armor) | GitHub |
| [HOI4 Focus GUI](https://github.com/TheCascadian/HOI4FocusGUI) | GitHub |

***

## Installation

1. Install NeoForge 21.1.219 (or a later 21.1 release) for Minecraft 1.21.1.
2. Drop `universaloreprocessing-<version>.jar` into your `mods` folder.
3. Launch. Materials are discovered automatically on world load and after every datapack reload.

Install JEI as well if you want the recipe views.

***

## Building From Source

Requires Java 21.

```bash
git clone https://github.com/TheCascadian/Universal-Ore-Processing.git
cd Universal-Ore-Processing
./gradlew build
```

The jar is written to `build/libs/universaloreprocessing-<version>.jar`.

| Task | Command |
|---|---|
| Run the client | `./gradlew runClient` |
| Run the server | `./gradlew runServer` |
| Run the game tests | `./gradlew runGameTestServer` |
| Regenerate the base textures | `python tools/generate_textures.py` (requires Pillow) |

***

## Project Layout

| Package | Contents |
|---|---|
| `config` | `OreProcessingConfig` |
| `registry` | `RegistryHandler` |
| `material` | `MaterialRegistry`, `MaterialDiscovery` and the game tests |
| `recipe` | The dynamic crush and wash recipes |
| `block` | Machine block, block entity, menu and machine kinds |
| `item` | The component-bearing material items |
| `client` | Tint handling, the machine screen and the JEI plugin |
| `command` | The `/uop` commands |

***

## License

Released under the [MIT License](LICENSE).
