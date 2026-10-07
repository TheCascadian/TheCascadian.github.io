![Universal Compression logo image](https://cdn.modrinth.com/data/cached_images/001fcbda049ad167a5011b3f77d710e4480cb730_0.webp)

![GitHub stars](https://img.shields.io/github/stars/TheCascadian/Universal-Compression?style=flat-square)
![GitHub watchers](https://img.shields.io/github/watchers/TheCascadian/Universal-Compression?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/TheCascadian/Universal-Compression?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/TheCascadian/Universal-Compression?style=flat-square)
![Minecraft](https://img.shields.io/badge/Minecraft-1.21.1-62b47a?style=flat-square)
![NeoForge](https://img.shields.io/badge/NeoForge-21.1.219-e68c2f?style=flat-square)
![Java](https://img.shields.io/badge/Java-21-5382a1?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
[![Discord](https://img.shields.io/discord/1201161505442381884?label=Discord&logo=discord&style=flat-square)](https://discord.com/invite/RuaR7CBy7Z)

# Universal Compression

Compress (nearly) _any_ block in the game into progressively denser stacks, **up to nine tiers deep**, no matter which mod added it.

***

## What It Does

At startup the mod registers nine compressed tiers for every eligible block in your instance, vanilla and modded alike.

*   **No upfront configuration required.** Every block from every installed mod is supported automatically, minus a built-in blacklist of blocks that do not compress well.
*   **Nine tiers.** Nine blocks craft into one compressed block, and that block is itself compressible. Repeat up to nine times. The math gets silly fast, and that is the point.
*   **Tier overlay.** A frame is drawn over the parent block's real model, so compressed blocks are always recognizable and keep the parent's textures, including logs, pillars and resource pack retextures.
*   **No datapack bloat.** Recipes, loot tables, models and language entries are generated virtually at runtime, so no files are written for every block combination.
*   **Blacklist and whitelist.** Exclude whole mods or single blocks in the config, and whitelist individual blocks to keep them even when their mod is blacklisted.

![Compressed wood and amethyst blocks, tiers 1 to 9](docs/images/overlay-wood-amethyst.png)

![Compressed deepslate and birch blocks, tiers 1 to 9](docs/images/overlay-deepslate-birch.png)

![Compressed ore blocks, tiers 1 to 9](docs/images/overlay-ores.png)

***

## How It Works

| Action | Result |
|---|---|
| 9 of a block in a crafting grid | 1 Tier 1 compressed block |
| 9 Tier N compressed blocks | 1 Tier N+1 compressed block, up to Tier 9 |
| 1 compressed block | 9 of the previous tier, or 9 of the original block at Tier 1 |

Compressed items are listed in their own creative tab. JEI shows Compressing and Decompressing categories when installed.

***

## Configuration

The config file is generated at `<instance>/config/universalcompression-common.toml`, and every option is also available in the in-game mod config screen. Blacklist changes need a game restart.

For a standard install of the Minecraft Launcher:
1. Keybind: Windows+R (this opens a small menu at the bottom of your screen)
2. Type `%appdata%` in the input box, then press Enter
3. Locate the `.minecraft` folder near the top
4. Navigate to your `config` folder from there

| Option | Purpose |
|---|---|
| `blacklist_namespaces_exact`, `_contains`, `_starts` | Skip whole mods by exact name, substring or prefix, each with its own on/off toggle |
| `blacklist_paths_contains` | Skip any block whose ID contains one of these strings |
| `excluded_mods`, `excluded_blocks` | Skip whole mods or individual block IDs (for example `minecraft:tnt`) |
| `whitelist_blocks` | Block IDs that are always compressed, overriding every blacklist rule (for example `xycraft_world:kivi`) |
| `hide_compressed_items_in_jei` | Hide compressed items from the JEI ingredient list |
| `show_compress_in_recipe_book`, `show_decompress_in_recipe_book` | Show or hide the recipes in the crafting book |

To exclude blocks without editing the config, add them to the block tag `universalcompression:non_compressible` from a datapack.

<details>
<summary>Default blacklist</summary>

> ❌ = excluded &nbsp;|&nbsp; ✅ = refined to a specific rule
>
> Many blanket namespace exclusions exist because only a handful of blocks from that mod had missing or incorrect textures. Auditing each one individually was deferred during development and will be addressed over time.

---

### Excluded Mods (entire namespace)

| | | | |
|---|---|---|---|
| ❌ Ae2 | ❌ Aether | ❌ Allthecompressed | ❌ Antibuilt |
| ❌ Ars Nouveau | ❌ Bellsandwhistles | ❌ Biomeswevegone | ❌ Chipped |
| ❌ Compact Machines | ❌ Corail Tombstone | ❌ Create | ❌ Createaddition |
| ❌ Domum Ornamentum | ❌ Enderio | ❌ Eternal Starlight | ❌ Extended Industrialization |
| ❌ Factoryblocks | ❌ Forbidden Arcanus | ❌ Handcrafted | ❌ Herbsandharvest |
| ❌ Immersive Engineering | ❌ Luminax | ❌ Macaw (all variants) | ❌ Mamas Merrymaking |
| ❌ Merrymaking | ❌ Mining Gadgets | ❌ Modern Industrialization | ❌ Mrcrayfish |
| ❌ Mysticalagradditions | ❌ Mysticalagriculture | ❌ Nightfall | ❌ Occultism |
| ❌ Oh The Biomes | ❌ Oritech | ❌ Path | ❌ Productivetrees |
| ❌ Quarryplus | ❌ Rechiseled | ❌ Refurbished Furniture | ❌ Regions Unexplored |
| ❌ Rftoolsbase | ❌ Rftoolsbuilder | ❌ Soundmuffler | ❌ Stevescarts |
| ❌ Structurize | ❌ Supplementaries | ❌ Tombstone (all variants) | ❌ Troolvidr |
| ❌ Twilightforest | ❌ Utilitarian | ❌ Xnet | ❌ Xtones Reworked |
| ❌ Xycraft Override | ❌ Xycraft World | | |

---

### Excluded Block Path Patterns (substring match, any mod)

| | | | |
|---|---|---|---|
| ❌ Advanced Machine Frame | ❌ Air | ❌ Aluminum Storage | ❌ Amorous Bristle |
| ❌ Ancient Debris | ❌ Ancient Podzol | ❌ Arcane Crystal | ❌ Ashen Deepturf |
| ❌ Azalea / Flowering Azalea | ❌ Bamboo Shoot | ❌ Battery | ❌ Bench |
| ❌ Bioshroom | ❌ Block Bio Fuel | ❌ Block Of Plastic | ❌ Bubble / Dense Bubble |
| ❌ Bush | ❌ Cactus | ❌ Candle | ❌ Cartography Table |
| ❌ Cave Hyssop | ❌ Chiseled Quartz | ❌ Cluster | ❌ Cobweb / Half Cobweb |
| ❌ Comb Block | ❌ Crafting Table | ❌ Crate | ❌ Crimson Fungus |
| ❌ Debug | ❌ Deepturf / Frozen Deepturf | ❌ Delightful Dirt | ❌ Dimension Boundary |
| ❌ Dragon Ice Spikes | ❌ Dried Kelp Block | ❌ Duckweed | ❌ Enhanced Galgadorian / Galgadorian |
| ❌ Fern | ❌ Fire | ❌ Fletching Table | ❌ Fluid Placeholder |
| ❌ Forbidden Arcanus Upwind / Whirlwind | ❌ Frogspawn | ❌ Fur | ❌ Garden |
| ❌ Ghost | ❌ Glistering / Glistering Ivy / Glistering Wart | ❌ Gloomgourd | ❌ Grass |
| ❌ Herb | ❌ Honey | ❌ Icicle | ❌ Infested |
| ❌ Ink Mushroom Stem | ❌ Invisible | ❌ Kelp Plant | ❌ Lamp |
| ❌ Lava Factory Casing | ❌ Leaves | ❌ Lily | ❌ Lodestone |
| ❌ Luminis | ❌ Machine Casing | ❌ Machine Frame | ❌ Machine Void Air |
| ❌ Magma Block | ❌ Matrix Frame | ❌ Medium / Thin / Wide Pot | ❌ Melon |
| ❌ Milky Comb | ❌ Miners Light | ❌ Miserabell | ❌ Mistletoe |
| ❌ Mortar | ❌ Mushroom | ❌ Nether Sprout / Sprouts | ❌ Phantom Booster |
| ❌ Pity Machine Frame | ❌ Placeholder | ❌ Prismoss | ❌ Pumpkin |
| ❌ Redstone Bud | ❌ Regalium | ❌ Reinforced Deepslate | ❌ Reinforced Metal Block |
| ❌ Rice Bag | ❌ Root | ❌ Royal Jelly | ❌ Runic |
| ❌ Scintling | ❌ Sculk Tendrils Plant | ❌ Seeping Ink | ❌ Shelf |
| ❌ Shimmerweed | ❌ Simple Machine Frame | ❌ Smooth Kivi | ❌ Smooth Quartz |
| ❌ Smooth Red / Smooth Sandstone | ❌ Snow Block | ❌ Solid Compact Machine Wall | ❌ Soldering Table |
| ❌ Soul Herb | ❌ Soulless Sandstone | ❌ Spore Blossom | ❌ Station |
| ❌ Structure Void | ❌ Supreme Machine Frame | ❌ Torch | ❌ Trophy |
| ❌ Tropical Garden | ❌ Twisting Vine | ❌ Undergarden Goo / Goo Block | ❌ Unexplored Log / Plank |
| ❌ Veiled / Veiled Mushroom | ❌ Warped Fungus | ❌ Wax / Wax Block / Wax Brick / Wax Tile | ❌ Waypoint Placeholder |
| ❌ Weeping Vines Plant | ❌ Whirlwind | ❌ Wild Flax / Wild Fluffy | |

---

### Compound Rules (mod + path condition)

| | | |
|---|---|---|
| ❌ Ae2 — path contains `certus` | ❌ Ars Nouveau — path contains `sourceberry` | ❌ Compact Machines — path equals `wall` |
| ❌ Create — path contains `quartz` | ❌ Farmers Delight — path contains `crate` | ❌ Ice And Fire — path contains `scale` |
| ❌ Minecraft — path contains `bamboo` | ❌ Minecolonies — path contains `waypoint` | ❌ Mysticalagriculture / Mysticalagradditions — path contains `ore` |
| ❌ Naturesaura — path contains `light` | ❌ Securitycraft — path contains `quartz` | ❌ Undergarden — path equals `goo` or `goo_block` |

</details>

***

## Installation

1. Install NeoForge 21.1.219 (or a later 21.1 release) for Minecraft 1.21.1.
2. Drop `universalcompression-<version>.jar` into your `mods` folder.
3. Launch. JEI is optional.

***

## Building From Source

Requires Java 21.

```bash
git clone https://github.com/TheCascadian/Universal-Compression.git
cd Universal-Compression
./gradlew build
```

The jar is written to `build/libs/universalcompression-<version>.jar`.

***

## License

Released under the [MIT License](LICENSE).
