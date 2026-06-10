# ---
# jupyter:
#   specta:
#     defaultLayout: article
#     hideTopbar: "Yes"
#     topbarTitle: "NumPy Basics (Percent Py)"
#   language_info:
#     name: python
#     version: "3.14.4"
#     mimetype: text/x-python
#     codemirror_mode:
#       name: ipython
#       version: 3
#     pygments_lexer: ipython3
#     nbconvert_exporter: python
#     file_extension: .py
# ---

# %% [markdown]
# # NumPy Basics — Percent Format
#
# This notebook demonstrates the **percent format** (`.py`).
# Cells are delimited by `# %%` markers.

# %%
import numpy as np

# Create a simple array
x = np.linspace(0, 2 * np.pi, 100)
print("x shape:", x.shape)

# %% [markdown]
# ## Trigonometry
#
# Let's compute sine and cosine values.

# %%
y_sin = np.sin(x)
y_cos = np.cos(x)

print("sin range:", y_sin.min().round(3), "to", y_sin.max().round(3))
print("cos range:", y_cos.min().round(3), "to", y_cos.max().round(3))

# %% [markdown]
# ## Linear Algebra

# %%
A = np.array([[1, 2], [3, 4]])
b = np.array([5, 6])

# Solve Ax = b
solution = np.linalg.solve(A, b)
print("Solution:", solution)
print("Verify Ax =", A @ solution)
