# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable design decisions

- The all-sites rule manager uses the selected “站点工作台” master-detail direction in a compact 880 × 640 extension popup window: a searchable/filterable site directory on the left and the selected site's request-header table on the right, with a persistent local-storage note and destructive site action in the footer. The popup uses the window's native close control.
- RequestKit provides two mutually exclusive rule modes: “按站点” keeps independent site profiles, while “所有站点” uses one shared header profile for every HTTP/HTTPS site. Switching modes preserves both configurations and only changes which one is active.
- Keep the “按站点 / 所有站点” mode switch directly in the 420 × 600 main extension popup so changing scope never requires opening the separate manager window.
- Keep RequestKit focused on configuring and applying request headers. New features must directly improve request-header editing, activation, scope, or reliability; do not expand into gray-release links, deployment/CI integrations, environment hit verification, screenshots, traffic inspection, mocking, or other business workflows.
- Allow duplicate header names within one profile. Header names are matched case-insensitively, and when multiple matching rules are enabled, the last rule in the list overrides earlier values.
