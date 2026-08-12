# Contributing

Thanks for contributing to ai-browser-fetch!

Before starting a larger feature, check the [project roadmap](ROADMAP.md) and open an issue to discuss it first.

## Getting Started

1. Fork the repository
2. Clone your fork
   ```bash
   git clone https://github.com/your-username/ai-browser-fetch
   cd ai-browser-fetch
   ```
3. Install dependencies
   ```bash
   npm install
   ```
4. Install Chromium
   ```bash
   npx playwright install chromium
   ```
5. Run the test suite
   ```bash
   npm test
   ```

## Development

```bash
npm test
```

All tests should pass before opening a PR.

## Branches

Use descriptive branch names branched from `main`:

```
feat/...
fix/...
docs/...
refactor/...
test/...
```

## Making Changes

- Keep changes focused — one thing per PR.
- Prefer simple solutions over unnecessary abstractions.
- Add or update tests for behavior changes.
- Manually test browser-related changes against relevant pages when practical.

## Pull Requests

1. Push your branch to your fork.
2. Open a PR against `main`.
3. Clearly describe what changed and why.
4. Include testing performed.
5. Keep PRs focused and reasonably small.

### Manual Testing Checklist

- [ ] Tests pass (`npm test`)
- [ ] Relevant CLI flags manually tested against a real URL
- [ ] No unrelated changes included

## Questions

If you're unsure about an approach, open an issue before doing substantial work.
