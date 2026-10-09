# Contributing

Thanks for helping keep this list complete and accurate. Corrections (wrong links, venues, or categories) are as welcome as new papers.

## What belongs here

The list follows the scope of the survey *From Trajectories to Experience: A Survey of Experience-Driven LLM Agents*. A work fits if it is about **agent experience**: action-guiding information grounded in task-execution trajectories and retained to guide later episodes. That covers:

- methods that **form**, **organize**, **utilize**, or **maintain** such experience (trajectory precedents, semantic lessons, or reusable procedures and skills);
- **evaluations and benchmarks** of experience quality, experience use, or sustained improvement;
- **applications** of experience-driven agents, plus **attacks and defenses** on evolving experience;
- closely related **surveys** and **foundations**.

Usually out of scope: memory that only stores facts, preferences, or documents not derived from trajectories; working state kept only within a single episode; and learning purely through parameter updates where no explicit experience supplies the training signal. Systems like these can still be listed when they bear directly on experience. Mark them as *adjacent* in the note.

## Adding or fixing an entry

1. Edit [`data/papers.yaml`](data/papers.yaml). Each entry looks like this:

   ```yaml
   - id: zhao2024expel                 # unique; a BibTeX-style key is ideal
     name: ExpeL                       # short display name
     title: 'ExpeL: LLM Agents Are Experiential Learners'
     authors: Zhao et al.
     venue: AAAI 2024                  # or "arXiv 2026" for preprints
     year: 2024
     date: 2023-08                     # first public version (YYYY-MM), e.g. arXiv v1
     paper: https://arxiv.org/abs/2308.10144
     code: https://github.com/LeapLabTHU/ExpeL   # optional
     categories: [formation.semantic, maintenance.consolidation]
     note: Compares success–failure pairs and recurring successes to extract insights.
   ```

   - `categories` must use ids from [`data/taxonomy.yaml`](data/taxonomy.yaml). List the primary one first. Add others only when the work makes a real contribution to that stage.
   - Keep `note` to one sentence that says what the work does with experience.

2. Regenerate the README and the website data:

   ```bash
   pip install pyyaml
   python scripts/build.py
   ```

3. Open a pull request that includes `data/papers.yaml`, `README.md`, and `docs/papers.json`. CI runs `python scripts/build.py --check` to validate the data and confirm the generated files are up to date.

Do not edit `README.md` by hand. It is generated from `scripts/README.template.md` and the data files.

If you would rather not edit files, [open an issue](https://github.com/xiaohuiyan/awesome-experience-driven-agents/issues/new) with the paper link and the category you suggest.
