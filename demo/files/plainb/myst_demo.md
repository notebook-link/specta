---
jupyter:
  specta:
    defaultLayout: slides
    slidesTheme: simple
    hideTopbar: 'No'
    topbarTitle: 'MyST Slides Demo'
    topbarThemeToggle: 'Yes'
  kernelspec:
    name: python3
    display_name: Python 3 (ipykernel)
    language: python
  language_info:
    name: python
    version: '3.14.0'
    mimetype: text/x-python
    codemirror_mode:
      name: ipython
      version: 3
    pygments_lexer: ipython3
    nbconvert_exporter: python
    file_extension: .py
---

+++

# MyST Notebook Demo

This file uses the **MyST Notebook** format. Cell boundaries are marked with `+++`
and code cells use `{code-cell}` directives.

+++

## Setup

The `+++` separator above started a new markdown cell.
Now let's write a code cell using the MyST directive syntax.

```{code-cell}
numbers = list(range(1, 11))
squares = [n ** 2 for n in numbers]
print("Numbers:", numbers)
print("Squares:", squares)
```

+++

## Cell Metadata

MyST cells support metadata like tags, which control notebook behaviour.

```{code-cell}
:tags: ["hide-input"]

# This cell has the 'hide-input' tag — its source will be hidden in rendered output.
pairs = list(zip(numbers, squares))
for n, s in pairs[:5]:
    print(f"{n}² = {s}")
```

+++

## Raw Cells

You can also include raw cells for non-executed content.

```{raw-cell}
This is a raw cell. Its content is passed through without execution.
Useful for LaTeX, HTML, or other output formats.
```

+++

## Conclusion

MyST is the most expressive plain-text notebook format, supporting all cell types
and rich metadata directly in Markdown syntax.
