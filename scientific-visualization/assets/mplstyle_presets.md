# Matplotlib style presets (converted from `.mplstyle` files)

The original skill shipped three `.mplstyle` files. They are reproduced here verbatim
so upload systems that reject unknown file types keep the same data. To use one,
read the block below and apply it with Matplotlib:

```python
import matplotlib.pyplot as plt
plt.style.use(<path to a temporary file written with this exact content>)
```

Each block below is standard Matplotlib style syntax (RFC-style `key: value` lines with
`#` comments). Matplotlib style files in this skill use double-quoted hex strings
(for example, `"#0072B2"`); quotes preserve `#` instead of starting a comment.

## `publication.mplstyle` — general scientific-publication starting style

Reviewed with Matplotlib 3.11.2 on 2026-10-01. Not a journal-compliance profile.

```mplstyle
# Usage: plt.style.use('publication.mplstyle')

# Figure properties
figure.dpi: 100
figure.facecolor: white
figure.autolayout: False
figure.constrained_layout.use: False
figure.figsize: 3.5, 2.5

# Font properties
font.size: 8
font.family: sans-serif
font.sans-serif: Arial, Helvetica, DejaVu Sans

# Axes properties
axes.linewidth: 0.6
axes.labelsize: 8
axes.titlesize: 8
axes.labelweight: normal
axes.spines.top: False
axes.spines.right: False
axes.spines.left: True
axes.spines.bottom: True
axes.edgecolor: black
axes.labelcolor: black
axes.axisbelow: True
axes.grid: False
# Five Okabe-Ito colors that meet 3:1 against white in sRGB.
# Still add markers, line styles, hatching, or direct labels.
axes.prop_cycle: cycler('color', ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#000000"])

# Tick properties
xtick.major.size: 3
xtick.minor.size: 2
xtick.major.width: 0.6
xtick.minor.width: 0.5
xtick.labelsize: 7
xtick.direction: out
ytick.major.size: 3
ytick.minor.size: 2
ytick.major.width: 0.6
ytick.minor.width: 0.5
ytick.labelsize: 7
ytick.direction: out

# Line properties
lines.linewidth: 1.5
lines.markersize: 4
lines.markeredgewidth: 0.5

# Legend properties
legend.fontsize: 7
legend.frameon: False
legend.loc: best

# Save properties
savefig.dpi: 300
savefig.format: pdf
# "tight" changes physical output dimensions; request it explicitly if wanted.
savefig.bbox: standard
savefig.pad_inches: 0.05
savefig.transparent: False
savefig.facecolor: white
savefig.edgecolor: white

# Editable TrueType text in PDF/PS. SVG text stays as text and is not embedded.
pdf.fonttype: 42
ps.fonttype: 42
svg.fonttype: none

# Image properties
image.cmap: viridis
image.aspect: auto
```

## `nature.mplstyle` — flagship Nature visual starting style

Snapshot source accessed 2026-10-01:
https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications
This preset does not establish submission compliance.

```mplstyle
# Usage: plt.style.use('nature.mplstyle')

# Figure properties
figure.dpi: 100
figure.facecolor: white
figure.constrained_layout.use: False
figure.figsize: 3.503937, 2.625  # 89 mm single-column starting width

# Font properties (Nature prefers smaller fonts)
font.size: 7
font.family: sans-serif
font.sans-serif: Arial, Helvetica, DejaVu Sans

# Axes properties
axes.linewidth: 0.5
axes.labelsize: 7
axes.titlesize: 7
axes.labelweight: normal
axes.spines.top: False
axes.spines.right: False
axes.edgecolor: black
axes.axisbelow: True
axes.grid: False
axes.prop_cycle: cycler('color', ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#000000"])

# Tick properties
xtick.major.size: 2.5
xtick.minor.size: 1.5
xtick.major.width: 0.5
xtick.minor.width: 0.4
xtick.labelsize: 6
xtick.direction: out
ytick.major.size: 2.5
ytick.minor.size: 1.5
ytick.major.width: 0.5
ytick.minor.width: 0.4
ytick.labelsize: 6
ytick.direction: out

# Line properties
lines.linewidth: 1.0
lines.markersize: 3
lines.markeredgewidth: 0.4

# Legend properties
legend.fontsize: 6
legend.frameon: False

# Save properties; DPI affects embedded raster artists in vector output.
savefig.dpi: 450
savefig.format: pdf
savefig.bbox: standard
savefig.pad_inches: 0.05
savefig.transparent: False
savefig.facecolor: white
savefig.edgecolor: white

pdf.fonttype: 42
ps.fonttype: 42
svg.fonttype: none

# Image properties
image.cmap: viridis
```

## `presentation.mplstyle` — presentation/poster style

Larger fonts and thicker lines for presentations, posters, and projected displays.
Reviewed with Matplotlib 3.11.2 on 2026-10-01.

```mplstyle
# Usage: plt.style.use('presentation.mplstyle')

# Figure properties
figure.dpi: 100
figure.facecolor: white
figure.constrained_layout.use: False
figure.figsize: 8, 6

# Font properties (larger for visibility)
font.size: 14
font.family: sans-serif
font.sans-serif: Arial, Helvetica, Calibri, DejaVu Sans

# Axes properties
axes.linewidth: 1.5
axes.labelsize: 16
axes.titlesize: 18
axes.labelweight: normal
axes.spines.top: False
axes.spines.right: False
axes.edgecolor: black
axes.axisbelow: True
axes.grid: False
axes.prop_cycle: cycler('color', ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#000000"])

# Tick properties
xtick.major.size: 6
xtick.minor.size: 4
xtick.major.width: 1.5
xtick.minor.width: 1.0
xtick.labelsize: 12
xtick.direction: out
ytick.major.size: 6
ytick.minor.size: 4
ytick.major.width: 1.5
ytick.minor.width: 1.0
ytick.labelsize: 12
ytick.direction: out

# Line properties
lines.linewidth: 2.5
lines.markersize: 8
lines.markeredgewidth: 1.0

# Legend properties
legend.fontsize: 12
legend.frameon: False

# Save properties
savefig.dpi: 300
savefig.format: png
savefig.bbox: standard
savefig.pad_inches: 0.1
savefig.transparent: False
savefig.facecolor: white
savefig.edgecolor: white

pdf.fonttype: 42
ps.fonttype: 42
svg.fonttype: none

# Image properties
image.cmap: viridis
```
