---
jupyter:
  specta:
    hideTopbar: Yes
    topbarThemeToggle: No
    defaultLayout: article
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

# Classic Markdown Notebook

This file uses the **classic Markdown** format. Prose text becomes markdown cells,
and fenced code blocks with a language tag become code cells.

## Getting Started

Let's start with a simple Python expression.

```python
message = "Hello from a classic Markdown notebook!"
print(message)
```

## Working with Data

We can write multiple code cells by using multiple fenced blocks.

```python
data = [1, 4, 9, 16, 25, 36]
total = sum(data)
average = total / len(data)
print(f"Sum: {total}, Average: {average}")
```

## String Operations

Markdown prose between code blocks becomes its own cell.
Here we do some string formatting.

```python
words = ["plainb", "converts", "text", "to", "notebooks"]
sentence = " ".join(words).capitalize() + "."
print(sentence)
print("Word count:", len(words))
```

## Conclusion

The classic Markdown format is the simplest way to write a notebook as plain text.
Just write normal Markdown — fenced code blocks become runnable cells automatically.
