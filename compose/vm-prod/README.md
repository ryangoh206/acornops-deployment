# compose/vm-prod

`compose.yaml` is the production-oriented base stack for Docker-on-VM deployments.

It is also used as the base for local stack composition when combined with `../local/compose.source.yaml`.

This directory also contains:

1. `proxy/` templates for edge routing
2. `oidc/dex/config.yaml` for local Dex profile

The production edge proxy adds browser hardening headers for console and API
responses. The management console upstream defaults to
`management-console:8080` because the production console image runs nginx as a
non-root user.

To customize management-console languages without rebuilding the image, add an
override file that mounts a host locale directory into the console container:

```yaml
services:
  management-console:
    volumes:
      - ./locales:/usr/share/nginx/html/locales:ro
```

The mounted directory should contain `manifest.json` and any referenced locale
JSON files, for example `fr.json`.
