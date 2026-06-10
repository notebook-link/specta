# ---
# jupyter:
#   specta:
#     defaultLayout: article
#     hideTopbar: "No"
#     topbarTitle: "Image Processing Gallery"
#     topbarThemeToggle: "Yes"
#   kernelspec:
#     name: python3
#     display_name: Python 3 (ipykernel)
#     language: python
#   language_info:
#     name: python
#     version: "3.14.0"
#     mimetype: text/x-python
#     codemirror_mode:
#       name: ipython
#       version: 3
#     pygments_lexer: ipython3
#     nbconvert_exporter: python
#     file_extension: .py
# ---
"""
# Image Processing with Skimage

This example demonstrates basic image processing operations.
It shows how to load, transform, and inspect images using scikit-image.

The Sphinx Gallery format uses a RST docstring as the first markdown cell,
followed by ``# %%`` sections.
"""

# %%
# ## Loading an Image
#
# We start by creating a synthetic test image using NumPy,
# since scikit-image may not be available in all environments.

import numpy as np

# Create a synthetic gradient image
rows, cols = 128, 128
image = np.zeros((rows, cols), dtype=np.float64)
for i in range(rows):
    for j in range(cols):
        image[i, j] = (i + j) / (rows + cols)

print("Image shape:", image.shape)
print("Value range:", image.min().round(3), "to", image.max().round(3))

# %%
# ## Applying a Threshold
#
# Thresholding converts a grayscale image to binary.
# Pixels above the threshold become 1, others become 0.

threshold = 0.5
binary = (image > threshold).astype(np.float64)

above = binary.sum()
total = binary.size
print(f"Pixels above threshold: {int(above)} / {total} ({100*above/total:.1f}%)")

# %%
# ## Computing Statistics
#
# Basic statistics help understand the image distribution.

print("Mean:", image.mean().round(4))
print("Std: ", image.std().round(4))
print("Median:", np.median(image).round(4))

# %%

