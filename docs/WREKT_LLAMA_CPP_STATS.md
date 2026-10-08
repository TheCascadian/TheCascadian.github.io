# Wrekt-llama.cpp: the measured record

**A llama.cpp fork tuned for one machine: a 6 GB GTX 1660 Ti and a Ryzen 5 7600X.** Every change was measured on that machine and kept or dropped on the numbers. This page collects those numbers, the experiments behind them, and what each one means.

<sub>Source: <a href="https://github.com/TheCascadian/Wrekt-llama.cpp">TheCascadian/Wrekt-llama.cpp</a> at commit <code>3a09cdb</code>, folder <code>local-tune/</code>. Measured 2026-10-05 to 2026-10-07. Speeds are tokens per second (t/s) on this one machine. Differences under about 3% are noise.</sub>

## How to read this page

The page is layered. Stop at whatever depth answers your question.

| Depth | What you see | Where |
|---|---|---|
| 1 | Headline results | Tables that are always visible |
| 2 | What each result means | The short paragraph under each heading, marked **In plain words** |
| 3 | Mechanism, commands, raw rows | Folded panels marked **Technical detail** and **Full data** |

<details>
<summary><b>Glossary: twelve terms used below</b></summary>

| Term | In plain words | Technically |
|---|---|---|
| Token | A piece of a word. "Benchmark" is about two tokens. | The unit a language model reads and writes. |
| t/s | Tokens per second. Higher is faster. | Throughput reported by `llama-bench` or the server. |
| Writing | The model producing its answer, one token at a time. | Decode, text generation, `tg`. |
| Reading | The model taking in your prompt before it answers. | Prompt processing, `pp`. Runs in batches, so it is far faster than writing. |
| Context | How much text the model can hold in mind at once. | The context window, in tokens. "15K" means 15,000 tokens already in the window. |
| KV cache | The model's notes on everything it has read so far. | Per-layer key (K) and value (V) tensors kept for attention. Grows with context. |
| Quantization | Storing numbers with fewer bits to save memory. | `f16` is 16-bit, `q8_0` 8-bit, `q4_0` 4-bit. Applies to weights (Q4_K, Q6_K) and to the KV cache. |
| Perplexity | A score for how well the model predicts real text. Lower is better. A big jump means something broke. | Exponentiated mean negative log-likelihood on a fixed corpus. |
| VRAM | The graphics card's own memory. This card has 6 GB. | 6144 MiB, of which about 5754 MiB is usable here. |
| GPU layers | How much of the model sits on the fast graphics card. The rest runs on the slower processor. | `-ngl N`. A model that does not fully fit runs as a hybrid. |
| Speculative decoding | Guessing the next stretch of text, then having the model confirm it in one step. | Draft tokens are verified in a batch. Accepted drafts cost one pass instead of many. |
| Noise | Run-to-run wobble that is not a real difference. | About 3% here. Smaller differences are treated as no change. |

</details>

## 1. The short version

**In plain words.** Five things made this machine meaningfully faster, and one made it able to hold far more text. Most other ideas were measured and thrown away.

| Result | In plain words | Before | After | Gain |
|---|---|---|---|---|
| 9B code edits | Rewriting code now copies what has not changed | 24.1 t/s | 169.6 t/s | <progress value="7" max="7">██████████████</progress> 7.0x |
| 7B reads a prompt | The card stopped imitating hardware it lacks | 168 t/s | 690 t/s | <progress value="4.1" max="7">████████░░░░░░</progress> 4.1x |
| 3B code edits | Same copying trick on a smaller model | 86.7 t/s | 273.7 t/s | <progress value="3.2" max="7">██████░░░░░░░░</progress> 3.2x |
| 7B writing, 15K context | The whole model now fits on the card | 18.2 t/s | 32.9 t/s | <progress value="1.81" max="7">████░░░░░░░░░░</progress> 1.81x |
| 7B writing, empty context | Same | 35.1 t/s | 53.6 t/s | <progress value="1.53" max="7">███░░░░░░░░░░░</progress> 1.53x |
| 9B writing, hybrid | A slow code path on the processor was skipped | 15.6 t/s | 20.6 t/s | <progress value="1.32" max="7">███░░░░░░░░░░░</progress> 1.32x |
| 7B writing, overclocked | Graphics memory run faster, with safety checks | 43.8 t/s | 50.7 t/s | <progress value="1.16" max="7">██░░░░░░░░░░░░</progress> 1.16x |

**Context capacity.** The 9B model holds **81,920 tokens** with all recall checks passing, inside the same 6 GB.

**Scorecard for 2026-10-06.** Twenty-six changes were measured in one day. Six were kept.

| Verdict | Meaning | Count | |
|---|---|---|---|
| Applied | In the build or the serving settings | 4 | <progress value="4" max="10">██████░░░░░░░░</progress> |
| Saved | A stored overclock state | 2 | <progress value="2" max="10">███░░░░░░░░░░░</progress> |
| Reference | A benchmark run, not a change | 1 | <progress value="1" max="10">█░░░░░░░░░░░░░</progress> |
| No gain | Measured, no real difference, dropped | 10 | <progress value="10" max="10">██████████████</progress> |
| No-go | Measured, made things worse, dropped | 6 | <progress value="6" max="10">████████░░░░░░</progress> |
| Not applied | Worked, but left out for a stated reason | 3 | <progress value="3" max="10">████░░░░░░░░░░</progress> |

<details>
<summary><b>Full data: all 26 trials with verdicts</b></summary>

| # | Time | Change | Verdict | Headline |
|---|---|---|---|---|
| A1 | 01:47-02:12 | GPU layers after the display moved to the integrated GPU | Applied | 9B +15% at 0K, 7B +37% at 0K |
| A2 | 02:18-02:32 | ngram-simple speculative decoding on code edits | Applied | 9B edit 7.0x, 3B edit 3.2x, open question unchanged |
| A3 | 02:18 | ngram-simple lookup length and map variants | No gain | defaults kept |
| A4 | 02:26 | Draft-model speculative decoding | No-go | best 1.7x on code, up to 68% slower elsewhere |
| A5 | 01:47-01:53 | Fusion disabled | No-go | writing 1-9% slower |
| A6 | 01:51-01:54 | Larger physical batch (`-ub 1024`, `2048`) | No gain | +1.5-3% for 70-900 MiB of VRAM |
| A7 | 01:56 | Host-side switches on the 9B hybrid | No gain | all within 20.5-21.3 t/s |
| A8 | 02:20-02:21 | Graph optimisation under server load | No gain | 139.4 against 139.2 t/s |
| B1 | 09:12-09:57 | KV cache: K at q8_0, V at q4_0 on the 7B | Applied | +11% at 0K, +16% at 15K, perplexity +0.02 |
| B2 | 09:39 | K at q4_0 on the 7B | No-go | perplexity 8.17 to 1534 |
| B3 | 10:03-10:12 | KV mixing and `--fit` on the 9B and 7B | No gain | 9B perplexity flat across KV types |
| C1 | 11:20 | ik_llama.cpp as an upper bound | No-go | reading 3.6x slower, writing equal or slower |
| C2 | 11:28-11:36 | DFlash draft head for the 9B | No-go | 1.8x over a slow baseline only |
| D1 | 12:11-12:19 | 9B at `-ngl 26` and `27`, 16K context | Not applied | `-ngl 26` stable, +4% at 0K |
| D2 | 12:24 | ngram-simple lookup n=24 on the 7B, long answers | Not applied | 2.2x on edit with the same text, refactor differs |
| E1 | 12:29-12:39 | System switches: power limit, locked clocks, memory offset, huge pages | No gain | none beat stock, 100 W costs 1-3% |
| F1 | 12:50-13:22 | Overclock, first sweep at 100 W | Saved | 43.8 to 47.5 t/s (+8%) |
| F2 | 13:25-13:46 | Overclock resumed at 120 W | Saved | 50.7 t/s (+16% over stock) |
| G1 | 13:56 | Full benchmark of the current state | Reference | +5-14% over the 11:21 run |
| H1 | evening | Guard verdict read from one token | Applied | about 45 ms per check, same verdicts on all 34 cases |
| H2 | evening | Physical batch size on the 4B | No gain | 955 to 971 t/s for every value |
| H3 | evening | Slot count on MiniCPM and the guard | Not applied | long output up, routing down |
| H4 | evening | Link-time optimisation build | No gain | 127 against 127 t/s |
| H5 | evening | Sampling on the GPU | No gain | every model within 3% |
| H6 | evening | Matrix-vector kernel shape | No gain | the current shape is fastest on all three models |
| H7 | evening | Output layer limited to allowed tokens | No-go | dropped before any code: about 2-3% |

</details>

## 2. The machine and its ceiling

**In plain words.** The graphics card has 6 GB of memory, but the driver and the desktop take some. What is left is the hard limit every experiment works against: go one megabyte over and the model fails to load.

| Part | Value |
|---|---|
| GPU | GTX 1660 Ti, 6144 MiB, Turing generation, no tensor cores |
| CPU | AMD Ryzen 5 7600X, 6 cores, 12 threads |
| RAM | 62 GB dual-channel DDR5, about 50 GB/s measured on CPU layers |
| Usable VRAM | **5754 MiB**. The driver reserves about 390 MiB. |
| Desktop cost | 660-890 MiB after one display moved to the integrated GPU (was about 1 GB) |

<details>
<summary><b>Technical detail: build, defaults, and the memory-speed figure</b></summary>

- **Build.** CUDA 13.4, gcc 16, `-DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=75 -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release`, kernel 6.18 (CachyOS LTS), driver 615.71.09.
- **Runtime defaults kept after measuring.** 6 threads (4 and 8 equal, 12 slightly worse), `-ub 512`, `-fa on`, models up to about 3B fully on the GPU.
- **Ceiling.** A context fails to create when used memory would pass 5754 MiB. Every context failure in section 5 is an allocation failure at that line.
- **Memory speed.** Two figures appear in the record. 288 GB/s is the stock graphics-memory rate. 331 GB/s is the theoretical rate after the overclock (192 pins at 13.8 Gbps). Percentages in section 4 use 331.

</details>

## 3. What was kept

### 3.1 Using the right kernels for this card

**In plain words.** The GTX 1660 Ti reports itself like the RTX 20 series, which has special hardware called tensor cores. This card does not have them, so it was imitating them slowly. The fork now recognises the card by name and uses the instructions it really has. Reading a prompt became about three to four times faster on every model tested.

| Model | Old build | New build | Gain |
|---|---|---|---|
| R1-distill 7B, on GPU | 168 t/s | 690 t/s | <progress value="4.1" max="4.2">██████████████</progress> 4.1x |
| gemma4-e2b, on GPU | 564 t/s | 2,169 t/s | <progress value="3.8" max="4.2">█████████████░</progress> 3.8x |
| MiniCPM5-2B, on GPU | 557 t/s | 2,021 t/s | <progress value="3.6" max="4.2">████████████░░</progress> 3.6x |
| deepseek-coder 1.3B, on GPU | 860 t/s | 2,901 t/s | <progress value="3.4" max="4.2">███████████░░░</progress> 3.4x |
| qwen2.5 3B, on GPU | 388 t/s | 1,331 t/s | <progress value="3.4" max="4.2">███████████░░░</progress> 3.4x |
| Qwythos 9B, 22 layers on GPU | 156 t/s | 500 t/s | <progress value="3.2" max="4.2">███████████░░░</progress> 3.2x |
| qwen3.5 4B, on GPU | 317 t/s | 1,021 t/s | <progress value="3.2" max="4.2">███████████░░░</progress> 3.2x |
| Qwythos 9B, CPU only | 140 t/s | 401 t/s | <progress value="2.9" max="4.2">██████████░░░░</progress> 2.9x |

<sub>Prompt reading, 512-token prompt, 3 repetitions, same session. Commit <code>a260d811e</code>.</sub>

<details>
<summary><b>Technical detail: what changed in the CUDA backend</b></summary>

GTX 16xx cards report compute capability 7.5, the same as RTX 20xx, so the backend selected MMA (tensor-core) kernels that then ran through emulation. The card is now detected by name and stored as `GGML_CUDA_CC_TURING_NO_MMA`.

- Matrix multiply uses dp4a MMQ kernels (generated instances, never edited by hand).
- Flash attention always picks the vector kernel at batch size 1.
- The tile kernel drops extra parallel blocks once output fills the GPU, which removed the cause of out-of-memory stops with f16 KV.
- `GGML_CUDA_FORCE_TURING_MMA=1` restores the old selection.

Side effects measured: writing in short chat unchanged (-1% to +3%). One cost: f16 KV on the GPU at 8K is 7% slower (42.0 against 45.0 t/s). Perplexity equal within error. `test-backend-ops -o FLASH_ATTN_EXT` passes. Quick health check after a rebase: reading on the 1.3B should be near 2,900 t/s, not 860.

</details>

<details>
<summary><b>Full data: KV type by placement by context, 7B, old to new</b></summary>

| KV type | Stored on | Reading at 0K | at 8K | at 16K | Writing at 0K | at 8K | at 16K |
|---|---|---|---|---|---|---|---|
| f16 | GPU | 168 → 690 | 110 → 439 | does not fit | 54.1 → 55.0 | 45.0 → 42.0 | does not fit |
| f16 | RAM | 170 → 678 | 109 → 423 | 77 → 300 | 48.1 → 48.9 | 15.9 → 15.5 | 9.7 → 9.3 |
| q8_0 | GPU | 164 → 676 | 106 → 429 | failed → 314 | 51.2 → 53.2 | 41.2 → 40.2 | failed → 32.6 |
| q8_0 | RAM | 172 → 665 | 105 → 396 | 77 → 302 | 48.9 → 49.9 | 21.2 → 20.3 | 13.7 → 13.9 |
| q4_0 | GPU | 160 → 671 | 110 → 427 | 81 → 288 | 48.7 → 52.9 | 41.3 → 40.4 | 33.2 → 31.1 |
| q4_0 | RAM | 171 → 633 | 105 → 403 | 80 → 307 | 51.0 → 50.5 | 26.1 → 25.6 | 18.6 → 18.3 |

"failed" means the old build could not create the 16K context. The q4_0 rows are valid as speeds only, because K at q4_0 breaks this model (section 3.3).

</details>

### 3.2 Skipping a slow path on processor layers

**In plain words.** The 9B model is too big for the card, so part of it runs on the processor. One "optimised" routine was slower than the plain version on this kind of processor. Turning it off for those layers made the 9B write 22-32% faster.

| 9B placement | Before | After | Gain |
|---|---|---|---|
| 22 layers on GPU (hybrid) | 15.6 t/s | 20.6 t/s | <progress value="32" max="35">█████████████░</progress> +32% |
| CPU only | 7.7 t/s | 9.4 t/s | <progress value="22" max="35">█████████░░░░░</progress> +22% |

<details>
<summary><b>Technical detail</b></summary>

`src/models/qwen35.cpp`: on x86, CPU-resident layers skip the fused raw-gate GDN path, which was 20-35% slower than separate sigmoid and softplus nodes. Models fully on the GPU are unaffected (1.3B and 3B moved within noise). After the change the fork matches plain llama.cpp on these rows (20.3 and 9.4 t/s). Commit `52b730eb4`.

</details>

### 3.3 Smaller notes: the KV cache at mixed precision

**In plain words.** The model keeps notes on everything it has read. Storing half of those notes at lower precision saved about 130 MiB, which was exactly enough to move the last piece of the 7B model onto the graphics card. Quality did not measurably change. Going one step further and compressing the other half destroyed the model's output.

| Setup, 7B at 16K window | Empty | 8K full | 15K full | Perplexity |
|---|---|---|---|---|
| Before: 28 layers on GPU, K q8_0, V q8_0 | 48.2-48.7 | 35.1-35.3 | 28.3-28.4 | 8.181 |
| Now: all layers on GPU, K q8_0, V q4_0 | 53.4-54.0 | 40.2-40.3 | 32.8-32.9 | 8.204 |
| Gain | <progress value="11" max="16">██████████░░░░</progress> +11% | <progress value="14" max="16">████████████░░</progress> +14% | <progress value="16" max="16">██████████████</progress> +16% | +0.02 (error is 0.14) |

| The step too far | Perplexity |
|---|---|
| K at q8_0 (kept) | 8.17 |
| K at q4_0 (rejected) | **1534** |

<details>
<summary><b>Technical detail</b></summary>

The vector attention kernel for K q8_0 with V q4_0 is now in the default build (`fattn.cu`, `CMakeLists.txt`, commit `afbf9a20c`). Other mixed pairs still need `-DGGML_CUDA_FA_ALL_QUANTS=ON`.

- The pair is not a speed setting on its own. At the same layer count it only saves memory. The speed comes from the extra layer that then fits.
- K at q4_0 breaks the 7B on every path: 1534 on the GPU, 4227 on the old build, 4064 with CPU attention.
- The reverse pair (K q4_0, V q8_0) has no CUDA kernel in this build. It falls back to CPU attention and looks hung at 8K.
- On the 9B, perplexity is flat across KV types (3.716 f16, 3.709 q8/q8, 3.708 q8/q4, 3.725 q4/q4), so the 9B can use q4/q4 for context capacity (section 5).

</details>

### 3.4 Putting the right pieces on the graphics card

**In plain words.** When a model does not fit, something has to run on the slower processor. Which pieces you leave there matters more than how many. Moving the attention pieces to the card and leaving the cheapest pieces behind made the 9B up to 54% faster with long conversations.

| 9B through the gateway | Empty | 8K full | 15K full |
|---|---|---|---|
| Before: `-ngl 25` | 26.9 | 21.6 | 18.9 |
| Now: placement C | 30.7 | 30.0 | 29.2 |
| Gain (computed from the two rows) | <progress value="14" max="54">████░░░░░░░░░░</progress> +14% | <progress value="39" max="54">██████████░░░░</progress> +39% | <progress value="54" max="54">██████████████</progress> +54% |

Before this, simply raising the layer count after a display was moved off the card had already helped:

| Model | Setting | Empty | 15K full |
|---|---|---|---|
| 9B | `-ngl 22` → `25` | 21.3 → 24.6 | 15.2 → 17.7 |
| 7B | `-ngl 24` → `28` | 35.1 → 48.2 | 18.2 → 28.5 |
| 7B | `-ngl 28` → all | 48.2 → 53.6 | 28.5 → 33.5 |

<details>
<summary><b>Technical detail: three experiments that led to placement C</b></summary>

**E1. Both CPU attention layers to the GPU.** Profiling showed CPU attention cost 6.3 ms per layer at 15K against 0.41 ms on the GPU. Result: 0% at 0K, +16% at 8K, +30% at 15K. Perplexity 5.3574 against 5.3588, both ±0.144.

**S1. Find the smallest stable set of CPU bytes.** Each 138 MiB block left on the CPU costs about 3-6% at every depth. The variant e1-drop9 (903 MiB on CPU) beat the shipped line by +6%, +19%, +23%, +34% at 0K, 8K, 12K, 15K. Going lower (765 and 821 MiB) ran out of memory.

**S3. Shrink the output matrix to make room.** Requantising only `output.weight` from Q6_K to Q4_K took it from 795.7 to 545.6 MiB. That freed room for two more blocks on the GPU. Perplexity 4.0059 to 4.0206, both ±0.050 (+0.4%).

Placement C is the result: Q4_K output file, `-ngl 99 -ot blk\.[45]\.=CPU,blk\.1[3467]\.=CPU`, 704 MiB on the CPU.

| Variant | CPU MiB | 0K | 8K | 15K |
|---|---|---|---|---|
| A: Q6_K output, e1-drop9 | 903 | 27.7, 27.9 | fail, 26.6 | fail, 24.7 |
| B: Q4_K output, same placement | 903 | 28.3, 27.6 | 27.4, 27.3 | 25.3, 25.5 |
| C: Q4_K output, six blocks on CPU | 704 | 31.1, 31.0 | 30.8, 30.3 | 29.6, 29.4 |
| Five blocks on CPU | 587 | 34.4, 34.5 | fail, 32.7 | fail, 31.1 |

Quantisation alone is worth 3% (row B). The gain is the two extra GPU blocks. The five-block set is faster but hit a CUDA error once, so it was not used.

Not yet done: the end-to-end job checks on placement C. Its correctness evidence so far is perplexity only.

</details>

### 3.5 Copying instead of rewriting: ngram speculation

**In plain words.** When you ask a model to edit a file, most of the answer is the file you gave it. With this setting the server guesses the next stretch by copying from the text already present, and the model confirms the guess in one step. The output is identical to the slow way. On open questions there is nothing to copy, so nothing changes.

| Model | Task | Without | With | Gain | Text |
|---|---|---|---|---|---|
| Qwythos 9B | edit | 24.1 | 169.6 | <progress value="7" max="7">██████████████</progress> 7.0x | identical |
| MiniCPM5-2B | edit | 127.4 | 764 | <progress value="6" max="7">████████████░░</progress> 6.0x | identical |
| qwen3.5 4B | edit | 77.2 | 443 | <progress value="5.7" max="7">███████████░░░</progress> 5.7x | identical |
| gemma4-e2b | edit | 130.2 | 621 | <progress value="4.8" max="7">██████████░░░░</progress> 4.8x | identical |
| qwen2.5 3B | rewrite | 86.6 | 386.9 | <progress value="4.5" max="7">█████████░░░░░</progress> 4.5x | identical |
| qwen2.5 3B | edit | 86.7 | 273.7 | <progress value="3.2" max="7">██████░░░░░░░░</progress> 3.2x | identical |
| Qwythos 9B | refactor | 24.0 | 52.7 | <progress value="2.2" max="7">████░░░░░░░░░░</progress> 2.2x | identical |
| any of them | open question | same | same | <progress value="1" max="7">██░░░░░░░░░░░░</progress> 1.0x | identical |

<sub>400 tokens, temperature 0, 3 repetitions. The 9B and 3B rows are in the unified record. The MiniCPM, 4B and gemma rows are read from the raw files of 2026-10-07 (<code>speculative/spec-ngram-*.csv</code>).</sub>

<details>
<summary><b>Technical detail: variants tried, and why the others lost</b></summary>

- **`ngram-simple` (kept).** 94-100% of drafted tokens accepted on edits. Identical text at temperature 0.
- **`ngram-mod`.** Often faster (up to 7.4x), but it remembers earlier requests, so repeated answers differ and it drafts on open questions too. Not like-for-like.
- **`ngram-map-k`, `ngram-map-k4v`.** Match the default on full rewrites, do nothing on edit or refactor.
- **Lookup size.** n=6 and n=8 are faster on code but start drafting on open questions (0-5% accepted) and can change the text. The default n=12 was kept.
- **On the 7B.** No gain at 400 tokens (51.5 against 51.4), because this model thinks before it writes and there is nothing to copy yet. With 2000-token answers it reached 2.0x but changed the answer, and was worse on one of two prompts. Not applied.
- **Draft model (a small second model guessing).** Best 1.7x on code, 18-68% slower on open questions in every variant. Rejected.
- **DFlash draft head for the 9B.** 1.8x, but only at a low layer count where the baseline is already slow. Rejected.
- **MTP drafters.** 0.83x with changed text, and 0.65x. Rejected.

</details>

<details>
<summary><b>Full data: draft model against ngram on the 3B</b></summary>

| Variant | edit | refactor | open question |
|---|---|---|---|
| none | 86.6 | 86.5 | 88.4 |
| ngram-simple | 273.3 | 254.9 | 88.2 |
| draft model, n-max 3 | 109.2 | 102.4 | 68.1 |
| draft model, n-max 8 | 121.0 | 98.3 | 38.7 |
| draft model, n-max 16 | 132.3 | 105.1 | 28.3 |
| draft model, n-max 16, p-min 0.75 | 143.9 | 126.2 | 72.4 |
| ngram-simple plus the line above | 277.5 | 214.5 | 72.3 |

</details>

### 3.6 A checked overclock

**In plain words.** Running the card's memory faster than its label makes it quicker, but pushed too far it makes silent mistakes: wrong answers with no crash. So a script raised the speed one step at a time and, after every step, ran a test whose result must match the original digit for digit. One flipped bit changes the result. The fastest setting that passed every check was saved.

| | Stock, 100 W | Saved |
|---|---|---|
| 7B writing, 4K context | 43.8 t/s | **50.7 t/s** <progress value="16" max="16">██████████████</progress> +16% |
| Memory offset | 0 (6001 MHz) | +2300 (6900 MHz) |
| Core offset | 0 | +105 (+120 passed, +135 failed) |
| Power limit | 100 W | 120 W |
| Soak test | | 14 of 14 passes, perplexity 12.8239 every time, 73-75 C |

<details>
<summary><b>Technical detail: how a step is judged</b></summary>

A step passes only if all five hold:

1. Clean exit.
2. No new `NVRM: Xid` line in the kernel log.
3. Perplexity equal to the stock value digit for digit. Core +135 failed this way twice (12.8248, then 12.8234).
4. Writing speed not under 93% of the best so far. Graphics memory retries bad transfers, which shows as lost speed before it shows as errors.
5. Temperature under 83 C. A hang or timeout counts as a failure.

Two runs: at 100 W the sweep saved memory +1400, core +105 for 47.5 t/s (+8%) after 13 soak passes. Resumed at 120 W, it saved memory +2300, core +105 for 50.7 t/s after 14 soak passes. About +5% of the total comes from the power limit alone.

System switches tried separately (100 W limit, locked clocks, memory +250, huge pages) gave no gain. Offsets live in the driver and reset at reboot. Still open: a multi-day soak with a kernel-log check.

</details>

### 3.7 A one-token safety verdict

**In plain words.** A small guard model checks every tool call an agent wants to make. Instead of waiting for it to write out a full answer, the system reads how sure it is about the first word. Same verdicts, a fraction of the time.

| | Before | After |
|---|---|---|
| Time per check | 214 and 239 ms | about 45 ms with the prompt cached |
| Verdicts on the 34 test cases | baseline | identical on all 34 |
| Correct verdicts | 30 of 34 | 30 of 34 |

<details>
<summary><b>Technical detail</b></summary>

The guard prompt ends with `{"hit_rule":` and the request asks for one token with its probabilities. The probability of `true` against a limit of 0.5 is the verdict. No other limit does better on the test set. Known misses: two attack tool calls score under 0.001 and pass, and one safe call scores 0.54 and is flagged. These are model limits, not threshold problems. The guard runs on the CPU (112 t/s) so it never pushes the agent model out of VRAM.

</details>

## 4. Where the time goes

**In plain words.** Profiling answered a simple question for each model: what is it waiting on? There were three different answers.

| Model | What limits it | In plain words | Can code fix it? |
|---|---|---|---|
| 7B and 4B, short context | Memory speed | To write one word the card re-reads about 4 GB of model. It already reads at 83-89% of the physical maximum. | No. Only fewer bytes help. |
| 7B, long context | Computation | Attention work grows with every token already read: from 3% of the time to over 40%. | Not found. Three kernel changes were tried and rejected. |
| 9B | The wrong device | The card is idle 60-66% of the time, waiting for layers on the processor. | Yes, by placement (section 3.4). |

Time to write one token, in milliseconds:

| Model | Context | Total | Weights | Attention | GPU idle |
|---|---|---|---|---|---|
| 7B | empty | 16.79 | 14.88 <progress value="14.88" max="16.79">████████████░░</progress> 89% | 0.59 | 0.38 |
| 7B | 15K | 28.73 | 15.20 <progress value="15.2" max="28.73">███████░░░░░░░</progress> 53% | 12.12 <progress value="12.12" max="28.73">██████░░░░░░░░</progress> 42% | 0.45 |
| 9B | empty | 39.26 | 14.23 | 0.11 | 23.41 <progress value="23.41" max="39.26">████████░░░░░░</progress> 60% |
| 9B | 15K | 54.28 | 14.34 | 2.45 | 35.96 <progress value="35.96" max="54.28">█████████░░░░░</progress> 66% |
| 4B | empty | 13.17 | 10.32 <progress value="10.32" max="13.17">███████████░░░</progress> 78% | 0.16 | 0.60 |
| 4B | 8K | 15.05 | 10.54 <progress value="10.54" max="15.05">██████████░░░░</progress> 70% | 1.82 | 0.56 |

<sub>The 9B rows were traced before placement C and have not been re-traced.</sub>

<details>
<summary><b>Technical detail: method and findings</b></summary>

**Tool.** A CUPTI activity tracer injected through `CUDA_INJECTION64_PATH` (`prof/cupti_trace.cpp`). No hardware counters were available without root, so memory traffic is bytes read divided by kernel time and cache behaviour is inferred. Tracer cost is 2-5%.

**Weights.** The 7B at 0K reads 4.25 GB per token in 14.9 ms: 294 GB/s for the fused gate/up kernel, 275 for plain Q4_K, 274 for the output layer, against 331 theoretical. Nothing in the matrix kernels can give 5% at batch size 1.

**7B attention.** Only `flash_attn_ext_vec` grows with context: 0.79 ms per 1000 tokens on the 7B (28 attention layers), 0.22 on the 4B (8 layers), 0.16 on the GPU part of the 9B. A KV-type test showed a 3.5x change in bytes moves time under 12%, and the largest format is fastest, so it is not memory-bound. The kernel uses 234 registers, which allows only two blocks of 128 threads per multiprocessor. Verdict: compute-bound on instruction count. The mechanism below that needs counters not exposed here.

**9B.** GPU busy is 34-40% of the token. The CPU attention loop for quantised KV does one generic dot product per K row and one conversion per V row: 6.3 ms per layer at 15K, about 15 times the GPU kernel.

**Ruled out as costs.** Launch overhead (one graph launch per token, GPU busy 96-98%), synchronisation (18 per token, 17 return at once), allocation (zero memory events per token), CPU/GPU transfer (0.06-0.14 ms).

</details>

<details>
<summary><b>Full data: time per token at every traced depth</b></summary>

| Model | Depth | Wall | GPU busy | Weights | Attention | quantize | Other | GPU idle |
|---|---|---|---|---|---|---|---|---|
| 7B | 0 | 16.79 | 16.41 | 14.88 | 0.59 | 0.30 | 0.63 | 0.38 |
| 7B | 4096 | 20.03 | 19.59 | 15.16 | 3.49 | 0.30 | 0.63 | 0.44 |
| 7B | 8192 | 22.67 | 22.28 | 14.92 | 6.42 | 0.31 | 0.64 | 0.39 |
| 7B | 12288 | 26.51 | 26.01 | 15.30 | 9.74 | 0.31 | 0.67 | 0.50 |
| 7B | 15360 | 28.73 | 28.28 | 15.20 | 12.12 | 0.31 | 0.65 | 0.45 |
| 9B | 0 | 39.26 | 15.85 | 14.23 | 0.11 | 0.28 | 1.23 | 23.41 |
| 9B | 4096 | 43.86 | 16.40 | 14.16 | 0.73 | 0.29 | 1.22 | 27.46 |
| 9B | 8192 | 46.59 | 16.78 | 14.03 | 1.26 | 0.27 | 1.21 | 29.81 |
| 9B | 12288 | 54.16 | 18.50 | 14.94 | 1.99 | 0.29 | 1.28 | 35.66 |
| 9B | 15360 | 54.28 | 18.32 | 14.34 | 2.45 | 0.28 | 1.24 | 35.96 |
| 4B | 0 | 13.17 | 12.57 | 10.32 | 0.16 | 0.30 | 1.80 | 0.60 |
| 4B | 8192 | 15.05 | 14.49 | 10.54 | 1.82 | 0.29 | 1.84 | 0.56 |

</details>

<details>
<summary><b>Full data: hottest kernels on the 7B</b></summary>

| Kernel | Job | Calls per token | ms at 0K | ms at 15K |
|---|---|---|---|---|
| `mul_mat_vec_q<Q4_K, fused>` | fused feed-forward gate and up | 28 | 7.17 | 7.20 |
| `mul_mat_vec_q<Q4_K>` | q, k, v, o, feed-forward down | 132 | 5.55 | 5.76 |
| `mul_mat_vec_q<Q6_K>` | output layer, 151665 x 3584 | 1 | 1.61 | 1.69 |
| `flash_attn_ext_vec<128, q8_0, q4_0>` | attention | 28 | 0.54 | 12.05 |
| `mul_mat_vec_q<Q5_K>` | matrix multiply | 7 | 0.51 | 0.51 |
| `quantize_q8_1` | input quantisation | 169 | 0.30 | 0.31 |
| `rms_norm_f32` | normalisation | 57 | 0.24 | 0.24 |
| `fwht_cuda` | Hadamard rotation | 112 | 0.17 | 0.17 |
| `k_set_rows_quant` | KV write | 56 | 0.13 | 0.13 |
| `rope_neox` | position encoding | 56 | 0.10 | 0.10 |

Only the attention kernel grows with context. Everything else is flat within 4%.

</details>

<details>
<summary><b>Full data: thirteen hypotheses and what happened to each</b></summary>

| # | Hypothesis | Expected | State |
|---|---|---|---|
| H1 | 9B: attention layers on GPU, GDN layers on CPU | +16% at 8K, +30% at 15K | Done, win (E1) |
| H2 | Shared-GQA vector kernel on the 7B | +10 to +25% at 15K | Rejected (S2): register spills, +1% at 12K |
| H3 | 9B: Q4_K output matrix frees room for two GPU layers | about +12% | Done, win (S3) |
| H4 | 9B: leave the smallest GDN layers on the CPU | +3 to +5% | Done, win (S1) |
| H5 | Faster CPU attention loop for quantised KV | large, but zero once H1 applied | Open, low priority |
| H6 | 4B: Q4_K output matrix | about +5% | Open, borderline |
| H7 | Cheaper V conversion in attention | at most 2-4% at 12K | Open, below the 5% bar |
| H8 | One shared input quantisation for Q, K, V | at most 1.5% | Rejected by ceiling |
| H9 | Fewer launches or syncs | at most 1.2% | Rejected by ceiling |
| H10 | Matrix-vector kernel compute changes | 0 at batch 1 | Rejected: already at 83-89% of memory speed |
| H11 | Attention occupancy (register diet, block count) | 0 | Rejected (E2, E3) |
| H12 | Attention is memory-bound | 0 | Rejected (KV type test) |
| H13 | Allocation churn per token | 0 | Rejected: zero memory events per token |

</details>

## 5. How much text fits

**In plain words.** Context is the model's desk. A bigger desk lets it work with a longer document or conversation, but every token on the desk costs memory. The goal here was the largest desk on which the 9B still finds three codes planted in the text. Lower-precision notes and smaller working batches took it from 49,152 to 81,920 tokens. Speed drops as the desk fills; anything at 5 t/s or more was accepted.

| 9B setup | Largest certified context | Speed there | Memory left |
|---|---|---|---|
| KV q8/q8, batch 512 | 49,152 <progress value="49152" max="81920">████████░░░░░░</progress> | 22.3 t/s | 5 MiB |
| KV q8/q4, batch 512 | 49,152 <progress value="49152" max="81920">████████░░░░░░</progress> | 21.7 t/s | 187 MiB |
| KV q4/q4, batch 512 | 65,536 <progress value="65536" max="81920">███████████░░░</progress> | 19.8 t/s | 252 MiB |
| KV q4/q4, batch 128 | **81,920** <progress value="81920" max="81920">██████████████</progress> | 18.9 t/s | 54 MiB |
| KV q4/q4, batch 64 | 81,920 <progress value="81920" max="81920">██████████████</progress> | 20.0 t/s | 61 MiB |

Where the memory goes at 81,920 tokens (q4/q4, batch 128):

| Part | MiB | |
|---|---|---|
| Model weights on the GPU | 3,858 | <progress value="3858" max="5754">█████████░░░░░</progress> |
| KV cache (the notes) | 770 | <progress value="770" max="5754">██░░░░░░░░░░░░</progress> |
| Working buffer | 356 | <progress value="356" max="5754">█░░░░░░░░░░░░░</progress> |
| Desktop and everything else | 716 | <progress value="716" max="5754">██░░░░░░░░░░░░</progress> |
| Free | 54 | <progress value="54" max="5754">█░░░░░░░░░░░░░</progress> |

<sub>Peak 5,700 of 5,754 MiB. The "desktop" row is the remainder: peak minus the three measured parts.</sub>

<details>
<summary><b>Technical detail: why 96K does not fit, and what is planned</b></summary>

- **Why the 9B scales well.** It is a hybrid: only 8 of its 32 layers have attention, so its KV cache costs about 9.6 KiB per token. The 7B has 28 attention layers and costs about 21 KiB per token (2.2 times as much), so the 7B is limited by KV and the 9B by weights and working buffer.
- **The deficit.** 96K needs about 154 MiB more KV and about 68 MiB more working buffer: roughly 220 MiB that is not there.
- **Batch size.** The working buffer scales with context and shrinks with `-ub`. Under `-ub 128` it is 84 MiB at 16K and 356 MiB at 80K (about 4.25 MiB per 1K tokens). Going to `-ub 64` saved only 18 MiB at 80K, so that track was aborted by its own rule.
- **Best open lead.** A forced vector kernel cut the working buffer at 49,152 from 220 to 55 MiB. The run was cut off before 65,536. If the saving holds, it closes most of the 96K deficit.

Planned, in order: finish the forced-vector run from 65,536 to 131,072; requantise the 9B feed-forward weights to 3-bit with an importance matrix (target under 3,500 MiB of weights); move the oldest KV to system RAM.

</details>

<details>
<summary><b>Full data: probe rows on the 9B</b></summary>

| Variant | Context | Peak MiB | Free | KV | Buffer | Writing t/s | Reading t/s | Codes |
|---|---|---|---|---|---|---|---|---|
| q8/q8 ub512 | 16,384 | 5055 | 699 | 322 | 144 | 28.9 | 487.2 | 3/3 |
| | 24,576 | 5226 | 528 | 458 | 184 | 27.4 | 456.1 | 3/3 |
| | 32,768 | 5400 | 354 | 594 | 224 | 25.9 | 426.0 | 3/3 |
| | 40,960 | 5666 | 88 | 730 | 264 | 23.0 | 400.7 | 3/3 |
| | 49,152 | 5749 | 5 | 866 | 304 | 22.3 | 370.1 | 3/3 |
| | 65,536 | allocation failure | | | | | | |
| q8/q4 ub512 | 16,384 | 4866 | 888 | 258 | 144 | 26.3 | 471.2 | 3/3 |
| | 32,768 | 5255 | 499 | 466 | 224 | 23.8 | 414.3 | 3/3 |
| | 49,152 | 5567 | 187 | 674 | 304 | 21.7 | 363.8 | 3/3 |
| | 65,536 | allocation failure | | | | | | |
| q4/q4 ub512 | 16,384 | 4848 | 906 | 194 | 144 | 26.6 | 472.5 | 3/3 |
| | 32,768 | 5071 | 683 | 338 | 224 | 24.1 | 415.6 | 3/3 |
| | 49,152 | 5278 | 476 | 482 | 304 | 22.1 | 374.4 | 3/3 |
| | 65,536 | 5502 | 252 | 626 | 384 | 19.8 | 337.9 | 3/3 |
| | 81,920 | allocation failure | | | | | | |
| q4/q4 ub128 | 16,384 | 4776 | 978 | 194 | 84 | 27.6 | 383.5 | 3/3 |
| | 32,768 | 4983 | 771 | 338 | 152 | 25.9 | 344.7 | 3/3 |
| | 49,152 | 5291 | 463 | 482 | 220 | 22.1 | 305.2 | 3/3 |
| | 65,536 | 5475 | 279 | 626 | 288 | 20.3 | 275.4 | 3/3 |
| | 81,920 | 5700 | 54 | 770 | 356 | 18.9 | 252.1 | 3/3 |
| | 98,304 | allocation failure | | | | | | |
| q4/q4 ub64 | 49,152 | 5486 | 268 | 482 | 206 | 23.7 | 263.5 | 3/3 |
| | 65,536 | 5655 | 99 | 626 | 272 | 21.5 | 240.2 | 3/3 |
| | 81,920 | 5693 | 61 | 770 | 338 | 20.0 | 224.0 | 3/3 |
| | 98,304 | allocation failure | | | | | | |
| q4/q4 ub32 | 65,536 | 5543 | 211 | 626 | 264 | 21.6 | 181.7 | 3/3 |
| | 81,920 | allocation failure | | | | | | |

</details>

<details>
<summary><b>Full data: other models, read from the raw probe files of 2026-10-07</b></summary>

These rows are not interpreted in the repository's own record. They are read here directly from `results/context/*.csv`. "Fits" means the context was created and ran. "Recalls" means all three planted codes came back.

| Model | KV type | Fits up to | Recalls 3 of 3 up to | Speed at that point |
|---|---|---|---|---|
| MiniCPM5-2B (Q4_K_M) | q8/q8 | 131,072 | 65,536 | 22.4 t/s |
| MiniCPM5-2B (Q4_K_M) | f16 | 81,920 | 65,536 | 19.9 t/s |
| MiniCPM5-2B (Q4_K_M) | q4_1/q4_1 | 131,072 | 65,536 | 26.1 t/s |
| gemma4-e2b | q8/q8 | 49,152 (run ends there) | 49,152 | 61.7 t/s |
| deepseek-coder 1.3B | all types | 16,384 | 8,192 | 93-116 t/s |
| qwen3.5 4B | q4/q4 | 163,840 | not certified | 20.4 t/s at 163,840 |
| qwen3.5 4B | q8/q4 | 131,072 | not certified | 22.8 t/s at 131,072 |
| R1-distill 7B | q8/q4 | 32,768 | not certified | 24.1 t/s at 32,768 |
| R1-distill 7B | q4/q4, batch 128 | 49,152 | not certified | 19.2 t/s at 49,152 |

Three things worth noticing:

- **Fitting is not remembering.** MiniCPM runs at 131,072 tokens, but recall is 3 of 3 only to 65,536, then 2 of 3 at 81,920 and 0 of 3 from 98,304. The memory ceiling and the useful ceiling are different numbers.
- **The 4B recall results are erratic.** Most series show 0 of 3 from 32,768 to 98,304 and then 3 of 3 at 114,688. That is not a believable curve, so no ceiling is claimed for it.
- **The 7B scored 0 of 3 in every row** of this run, including small contexts, so the recall probe does not work for it as run. Its numbers above are memory ceilings only. Its q4/q4 rows are also speed-and-memory only, because K at q4_0 breaks this model.

MiniCPM writing speed as its context fills (q8/q8): 84.4 at 8K, 60.6 at 16K, 39.1 at 32K, 28.6 at 49K, 22.4 at 65K, 18.5 at 82K, 15.7 at 98K, 13.6 at 115K, 12.0 at 131K.

</details>

## 6. The MiniCPM quantization lab

**In plain words.** Ten versions of the same small model were built, each storing a different part at lower precision, to see what could be squeezed without hurting it. Small squeezes were free. The aggressive one was a clear loss: smaller, but a third slower and measurably worse.

| Variant | File size | Writing | Perplexity | Reading |
|---|---|---|---|---|
| Baseline Q4_K_M | 1.556 GB | 138.8 t/s | 8.946 | 1,952 t/s |
| Importance-matrix Q4_K_M | 1.556 GB | 138.6 t/s | **8.870** | 1,916 t/s |
| Output layer at Q4_K | 1.487 GB | 143.9 t/s | 9.050 | 1,961 t/s |
| Feed-forward down at Q4 | 1.520 GB | 141.1 t/s | 9.177 | 1,963 t/s |
| Three squeezes stacked | 1.450 GB | **147.4 t/s** | 9.288 | 1,912 t/s |
| 3-bit feed-forward, importance matrix | **1.277 GB** | 95.3 t/s | 9.527 | 1,756 t/s |

| Against baseline | Size | Writing speed | Perplexity |
|---|---|---|---|
| Three squeezes stacked | -6.8% | +6.2% | +0.34 |
| 3-bit feed-forward | -17.9% | **-31%** | +0.58 |

<sub>Perplexity error is about ±0.39 on this 16-chunk corpus, so only the 3-bit variant is clearly outside it. No verdict for these variants is recorded in the repository; the reading above is from the raw files.</sub>

<details>
<summary><b>Full data: all ten variants</b></summary>

| Variant | Size GB | Reading t/s | Writing t/s | Perplexity | ± |
|---|---|---|---|---|---|
| baseline-Q4_K_M | 1.556 | 1951.7 | 138.8 | 8.9460 | 0.390 |
| H5-imatrix-q4km | 1.556 | 1916.0 | 138.6 | 8.8702 | 0.384 |
| H1b1-ffn_down-q6to-q5 | 1.554 | 1935.8 | 138.5 | 8.9893 | 0.393 |
| H1b2-ffn_down-q6to-q4 | 1.520 | 1963.2 | 141.1 | 9.1769 | 0.404 |
| H3c-output-q4K | 1.487 | 1961.0 | 143.9 | 9.0501 | 0.395 |
| H6a-token_embd-q5K | 1.590 | 1957.5 | 139.2 | 8.9706 | 0.392 |
| H7a-attn_v-q6to-q5 | 1.556 | 1962.0 | 137.9 | 8.9584 | 0.391 |
| H7b-attn_v-q6to-q4 | 1.555 | 1939.5 | 138.9 | 8.9494 | 0.389 |
| H10-stack-H1b2-H3c-H7b | 1.450 | 1912.4 | 147.4 | 9.2879 | 0.407 |
| H11-imx-iq3s-ffn | 1.277 | 1755.7 | 95.3 | 9.5272 | 0.409 |

512-token prompt, 128 tokens written, 3 repetitions, all layers on the GPU.

</details>

## 7. The models and what each can do

**In plain words.** Eight models are served through one gateway, each with a job. Speed alone does not qualify a model, so each one also has to pass small fixed checks for its job.

| Model | Job | Writes | Reads | All slots at once | Job checks |
|---|---|---|---|---|---|
| virbiusguard | checks every tool call | 348 t/s | 6,504 t/s | 640 t/s (4) | attacks 11 of 12, no safe input blocked |
| deepseek-coder 1.3B | code completion | 167 t/s | 3,027 t/s | 465 t/s (4) | code 3 of 4 |
| gemma4-e2b | swarm worker | 137 t/s | 2,032 t/s | 349 t/s (8) | routing 16 of 16, tools 6 of 6 |
| minicpm5-2b | routing, tool calls | 136 t/s | 1,970 t/s | 305 t/s (8) | routing 16 of 16, tools 6 of 6 |
| qwen3.5-4b | agent, tool calls, code | 78.4 t/s | 986 t/s | | tools 6 of 6, code 4 of 4 |
| qwythos-9b | large model | 26.4 t/s | 541 t/s | | tools 6 of 6, code 3 of 4 |

Also served: an embedding model (454 items/s) and a reranker (38.9 items/s).

<details>
<summary><b>Technical detail: why small models gain from more slots</b></summary>

Small models are held back by fixed cost per token, not by memory speed, so running several requests at once recovers throughput. MiniCPM writes 134 t/s on one stream and 659 t/s across 32. Effective memory rate while writing: 222 GB/s on the 4B (77% of the stock 288), 188 on MiniCPM, 136 on the guard.

The trade-off is why the slot count was not raised: MiniCPM long output goes 322, 468, 568, 642, 659 t/s at 8, 12, 16, 24, 32 slots, while routing falls from 24.4 to 18.0 items/s.

The 9B row above (26.4 t/s) predates placement C. Its current serving speed is in section 3.4.

</details>

<details>
<summary><b>Full data: models tested and not added</b></summary>

| Model | Outcome | Writes | Reason |
|---|---|---|---|
| gemma4-e2b with MTP drafter | Not added | 125 | drafter 0.83x, text changed |
| sharp-spark-4b | Not added | 65.7 | tool calls 3 of 6, 900 MiB larger than qwen3.5-4b |
| qwen3.5-4b with MTP drafter | Not added | 63.3 | drafter 0.65x |
| sharp-minicpm 2B Q6_K_XL | Dropped | 107 | lost first round |
| qwen2.5-3b Q5_K_M | Dropped | 103 | replaced by gemma4-e2b (136 t/s, +33%) |
| agents-a1 4B Q4_K_M | Dropped | 78.7 | lost first round |
| ternary-bonsai 8B PQ2_0 | Dropped | 69.6 | lost first round |
| deepseek-r1-distill 7B Q4_K_S | Excluded from suites | 54.0 | still served |

</details>

## 8. What did not work

**In plain words.** Most ideas failed, and that is the useful part of the record: each failure has a number attached, so nobody has to try it again.

| Idea | Why it was dropped |
|---|---|
| Compress the K half of the notes to 4-bit (7B) | Perplexity 8.17 to 1534. Output destroyed. |
| A second small model to guess ahead | Open questions 18-68% slower in every variant. |
| A different fork (ik_llama.cpp) as a faster base | Reading 3.6x slower, writing equal or slower. |
| Rewrite the attention kernel to share work across heads | Ran out of registers and spilled. +1% at 12K. |
| Larger batches, graph switches, fusion off, host-memory switches | No gain, or slower. |
| Push the 9B to five blocks on the CPU | Faster, but one CUDA error. |
| Core clock +135 | Failed the digit-for-digit check twice. |

<details>
<summary><b>Full data: every rejected approach with its measured cause</b></summary>

| Approach | Quantified cause |
|---|---|
| Force quantised KV to the f16-converting kernel | Slower or equal in every cell (q8_0 at 8K: 41.7 to 34.0) |
| Shared-GQA vector kernel (S2) | 255 registers plus 176 bytes of stack; +1% at 12K, +2.5% at 15K |
| Attention block count (E2) | Default of 5 is best: 39.0 against 34.4, 35.8, 37.8, 37.0 |
| K dot over 8 threads per row (E3) | 38.74 and 38.42 against 38.97 and 38.12 |
| Memory-speed explanation of attention growth | A 3.5x byte change moves time under 12% |
| Matrix kernel work at batch size 1 | Already at 83-89% of memory speed |
| Shared input quantisation for Q, K, V | Ceiling of 1.5% |
| Hadamard rotation kernels | 0.17 ms per token, about 1% |
| Launch, sync, allocation, transfer | Together under 3% of a token |
| K at q4_0 on the 7B | Perplexity 8.17 to 1534 (4227 old build, 4064 CPU attention) |
| K q4_0 with V q8_0 | No CUDA kernel; CPU fallback appears hung at 8K |
| Draft-model speculation | Open question 18-68% slower in every variant |
| DFlash draft head for the 9B | Needs fewer GPU layers; 1.8x against 7.0x for ngram-simple |
| MTP drafters | 0.83x with changed text, and 0.65x |
| ngram-simple on the 7B | Thinking text repeated; one of two prompts worse |
| ik_llama.cpp | Reads 3.6x slower, writes equal or slower |
| CUDA Graphs on or off, graph optimisation, fusion off, `-ub 1024` and `2048` | No gain, or slower |
| Backend steps B1 to B6 for the added models | All within noise; best case 2-3% |
| Fewer than 903 MiB on CPU with the Q6_K output | Out of memory at 8K to 15K |
| Five-block CPU set (587 MiB) | One CUDA error |
| `-ub 64` and `-ub 32` for 96K and 80K | Saves 18 MiB at 80K; 96K still fails |
| `-ngl 27` on the 9B at 16K | Failed to create the 15K context once |
| High-precision window for recent tokens | V at q4 is already inside error; K below q8 fails at any age |

Not rejected, only unmeasured: memory profile and FCLK in the BIOS, C-states, SMT off, `mitigations=off`, pinned host memory for KV in RAM, and research KV-compression methods.

</details>

## 9. How the numbers are kept honest

**In plain words.** A faster number is worthless if the answers changed. So every change had to prove it was still correct before its speed counted, and anything inside the noise band was recorded as no change.

| Rule | What it means |
|---|---|
| Correct first, fast second | Backend tests pass, same text at temperature 0, job scores do not drop |
| 3% is noise | A difference under 3% in both runs is recorded as no change |
| At least 3 repetitions | And two interleaved passes for anything close |
| Baseline in the same run | Before and after are measured back to back, never against an old file |
| One change at a time | Then stacked, and only winners stay |
| Ceiling check before code | If the best possible gain is under about 5%, the idea is dropped unwritten |
| Everything recorded | Including the failures |

<details>
<summary><b>Technical detail: limits of this record</b></summary>

- **One machine.** Every number is from one card, mostly single passes of 3 repetitions.
- **Perplexity values are not comparable across experiments.** The 7B shows 12.8239 in the overclock check and 8.18 in the KV trials; the 9B shows 3.71, 5.36 and 4.01 in three experiments. These differ by corpus and chunk count. Only pairs from the same run are valid.
- **The recall test is three planted keys.** It is not a full needle-in-a-haystack test. Needle recall, code checks and tool checks at 49K to 81K have not been recorded.
- **Two memory-speed figures.** 288 GB/s stock and 331 GB/s overclocked both appear; see section 2.
- **An unexplained column.** The context probe reports 2,788 MiB of CPU model for every 9B row while placement C puts 704 MiB on the CPU. The record treats 2,788 as the memory-mapped file and 704 as the bytes read per token, but this is not reconciled.
- **Sections 5 and 6 include my own reading of raw files** from 2026-10-07 that the repository's record does not yet interpret. Those passages are marked.

</details>

## 10. What is still open

**In plain words.** The biggest remaining wins are in context size, not speed.

1. **Finish the forced-vector context run** from 65,536 to 131,072 on the 9B. It is the only measured lever that moves the working buffer by more than a few megabytes.
2. **Requantise the 9B feed-forward weights to 3-bit** with an importance matrix, gated on perplexity. The MiniCPM lab in section 6 is a caution: the same idea cost a third of the speed there.
3. **Move the oldest KV to system RAM** for 128K, accepting anything at 6 t/s or more.
4. **Run the job checks on placement C.** Its evidence so far is perplexity only.
5. **Re-trace the 9B** on placement C. The time split in section 4 is from before it.
6. **A multi-day overclock soak** with a kernel-log check.

<details>
<summary><b>Full data: coverage, what has and has not been run on each model</b></summary>

| Experiment | 1.3B | 3B | 4B | 7B | 9B | 2B class |
|---|---|---|---|---|---|---|
| Kernel selection | run | run | run | run | run | run |
| GDN CPU path | run, no effect | run, no effect | not run | n/a | run | n/a |
| K q8_0 / V q4_0 pair | not run | not run | partial | run | partial | not run |
| GPU layer count and placement | n/a | n/a | not run | run | run | n/a |
| ngram-simple | run | run | run (10-07) | run, not applied | run | run (10-07) |
| Draft-model speculation | n/a | run | not run | partial | not run | n/a |
| MTP and DFlash drafters | n/a | n/a | run | n/a | run | run |
| Attention kernel changes | n/a | n/a | not run | run, all rejected | not run | n/a |
| Q4_K output matrix | n/a | n/a | not run | n/a | run | run (10-07, MiniCPM) |
| Profiling trace | not run | not run | run | run | run, before placement C | not run |
| Context ceiling | partial (10-07) | not run | partial, uncertified | partial, uncertified | run, certified | partial (10-07) |
| GPU overclock | n/a | n/a | not run | run | not run | not run |

Entries marked 10-07 are from raw result files newer than the repository's own coverage table.

</details>

## 11. Where each number comes from

<details>
<summary><b>Result families in <code>local-tune/results/</code></b></summary>

| Family | Contents | Used in |
|---|---|---|
| `throughput/` | Old against new builds, layer counts, batch sizes, switches, MiniCPM variants | 3.1, 3.2, 3.4, 6, 8 |
| `kv/` | KV type matrix and mixed-precision trials | 3.1, 3.3 |
| `speculative/` | ngram, draft-model and drafter trials | 3.5 |
| `quality/` | Perplexity runs | 3.3, 3.4, 6 |
| `profiling/` | Trace summaries, placement and kernel experiments | 3.4, 4 |
| `context/` | Context ceiling probes | 5 |
| `hardware/` | Overclock and system-switch runs | 3.6 |
| `suites/` | End-to-end suite runs and job checks | 3.7, 7 |

The repository's own full record is [`local-tune/UNIFIED.md`](https://github.com/TheCascadian/Wrekt-llama.cpp/blob/master/local-tune/UNIFIED.md). To rerun: `local-tune/scripts/bench.sh`, `compare.py`, `ppl.py`, `spectest.py`, `ctxprobe.py`, `suite.py`, and `gpu-push.py`.

</details>
