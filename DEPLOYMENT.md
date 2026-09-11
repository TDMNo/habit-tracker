# Habit Tracker — Deployment

## 1. Status

CI/CD bootstrap is configured, but the new Habit Tracker application is not deployed yet.

The repository still contains the legacy Vanilla JS prototype. Production deployment is intentionally locked so the legacy prototype cannot be published to `docker-home` by the new pipeline.

Verified on 2026-09-11:

- dedicated repository runner is connected;
- runner service is persistent via systemd;
- GitHub Actions can execute a job on `docker-home` as user `leo`;
- Docker and Docker Compose are available to the runner;
- production checkout exists at `/opt/stacks/habit-tracker` and was clean during the smoke test.

## 2. Current release flow

```text
feature / PR
→ Habit Tracker CI on GitHub-hosted runner
→ merge/push to main
→ Habit Tracker CI for exact main commit
→ CI PASS
→ Habit Tracker PROD Deploy
→ repository-scoped self-hosted runner on docker-home
→ scripts/deploy-prod.sh
→ production safety lock
```

While `/opt/stacks/habit-tracker/.prod-enabled` is absent, the deployment workflow exits safely without changing the running server.

## 3. CI

Workflow: `.github/workflows/ci.yml`.

During bootstrap it validates required project documentation. Once the modern Node application exists with `package.json` and `package-lock.json`, CI automatically runs dependency installation, available typecheck/tests and the production build.

CI must be strengthened together with the new React/API implementation rather than pretending the legacy static prototype is the final application.

## 4. Production runner

Dedicated repository runner:

- host: `docker-home`;
- Linux x64;
- runner name: `docker-home-habit-tracker`;
- user: `leo`;
- installation: `/home/leo/actions-runner-habit-tracker/actions-runner`;
- production checkout: `/opt/stacks/habit-tracker`.

The runner is scoped to `TDMNo/habit-tracker` and is not shared with Genealogy.

## 5. Production activation gate

Deploy script: `scripts/deploy-prod.sh`.

Before any real deployment it requires:

- explicit server-side activation file `.prod-enabled`;
- modern application `package.json`;
- `docker-compose.prod.yml`;
- server-only `.env.production`;
- exact CI-tested commit;
- clean production checkout on `main`;
- fast-forward-only deployment history.

Even after activation, the final Docker service update logic must be implemented and reviewed together with the new application stack before production can change.

## 6. Target production flow

When the new application is ready, the locked stage will be extended to:

```text
CI PASS
→ backup
→ backup verification
→ Docker build of exact CI-tested commit
→ migrations when required
→ update only Habit Tracker services
→ container health
→ private health endpoint
→ public HTTPS health endpoint
→ fast-forward production checkout
```

Persistent PostgreSQL data must never be removed or recreated as part of a normal application deployment.

## 7. PWA release checks

Production verification must include manifest correctness, service worker/cache update behavior, install/update on phone and compatibility between cached client state and the current API.

## 8. Still open before real PROD activation

- exact backend framework and final runtime layout;
- Docker Compose service names and ports;
- production domain and HTTPS route;
- production environment/secrets;
- PostgreSQL storage path;
- backup location and retention;
- exact private/public health endpoints;
- restore procedure and rollback validation.

These values must be based on the implemented application and actual server state, not guessed in advance.
