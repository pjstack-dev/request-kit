# RequestKit All-Sites Options Design QA

- Source visual truth: `docs/options-design-reference.png`
- Initial implementation screenshot: `docs/options-implementation-initial.png`
- Final implementation screenshot: `docs/options-implementation-final.png`
- Full-view comparison evidence: `docs/options-design-comparison-final.png`
- Focused detail comparison evidence: `docs/options-design-comparison-detail.png`
- Responsive evidence: `docs/options-implementation-1024.png`
- Mobile-width evidence: `docs/options-implementation-390.png`
- Viewport: 1440 × 1024
- State: `admin.example.com` selected, five site profiles, three request-header rules
- Browser verification: Codex in-app browser at the local Vite preview

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation uses Manrope for Latin product text and the platform CJK UI stack for Chinese. Page hierarchy, hostname weight, table labels, row text, truncation, and compact settings typography match the selected image closely.
- Spacing and layout rhythm: the 64 px app bar, 422 px site pane, selected-row geometry, 266–518 px rule-table span, 793–855 px add-site action, and 110 px persistent footer align with the normalized visual target. The 1440 × 1024 page has no page-level overflow.
- Colors and visual tokens: white surfaces, cool-neutral dividers, blue-violet active controls, green enabled indicators, muted disabled controls, and red destructive actions follow the selected visual and the existing popup tokens.
- Image quality and asset fidelity: the existing RequestKit PNG mark is reused at native quality. All UI icons use the existing Phosphor family; no placeholder art, custom SVG, CSS illustration, or emoji substitute is present.
- Copy and content: all visible app-specific copy is Simplified Chinese and matches the approved information architecture. Sensitive header values are masked in previews.
- Icons and controls: site icons, switches, pencils, overflow menus, add actions, help/settings controls, and destructive actions are consistently aligned and have accessible labels.
- Responsiveness and accessibility: at 1024 × 768, body and detail regions have no horizontal overflow, the site list becomes internally scrollable, and the add-site control remains above the persistent footer. At 390 px wide, the workspace becomes a single column, rule rows use a compact two-line layout, and the body, top bar, footer, detail region, and rule rows have no horizontal overflow. Site selection and site switches are separate accessible controls. Focus states and reduced-motion preferences are implemented.

## Focused Region Comparison

`docs/options-design-comparison-detail.png` compares the selected site's identity, master control, primary action, rule table, value previews, toggles, edit/overflow controls, and helper text in one normalized input. It confirms that the dense controls remain readable and that the implementation does not substitute different component anatomy.

## Interaction Verification

- Opened the all-sites page from the popup's top-right gear action.
- Searched by site hostname and cleared the search.
- Filtered to disabled sites and restored the all-sites view.
- Switched site selection and toggled a site's master enable state.
- Added a request-header rule, edited its value, disabled it, opened its overflow menu, and deleted it.
- Added a new site profile, opened the destructive confirmation dialog, and deleted the test site.
- Verified the 1440 × 1024 page has matching client and scroll dimensions: 1440 × 1024.
- Verified 1024 × 768 has no horizontal overflow; the site list scrolls internally while the add-site action remains visible.
- Verified 390 × 844 has no horizontal overflow and uses the intended single-column rule layout.
- Re-ran rule add/save/delete after the persistence and mutation-lock review fixes.
- Checked browser console warnings and errors after the final render: none.
- Ran all 15 request-rule, state-revision, conflict, exact-hostname, synchronization, and validation tests: all passed.
- Ran the production Vite build with popup, options page, and background-worker entries: passed.

## Comparison History

### Pass 1

- [P2] The add-site control was pinned too close to the bottom footer, and rule rows exposed a delete icon where the visual target used an overflow action.
- Fix: changed the site list/footer sizing so the action follows the five-row directory, and moved rule deletion into a functional overflow menu.
- Post-fix evidence: `docs/options-implementation-pass-1.png`.

### Pass 2

- [P2] The bottom privacy/action bar was shorter than the selected image, leaving excess whitespace above it; the rule table also sat too low and was slightly too tall.
- Fix: set the persistent footer to 110 px, aligned the add-site action to 793–855 px, and calibrated the rule table to 266–518 px with 66 px rows.
- Post-fix evidence: `docs/options-implementation-final.png` and `docs/options-design-comparison-final.png`.

### Pass 3

- [P2] At a 768 px viewport height, the earlier site-list maximum could force the add-site footer below the visible workspace.
- Fix: recalculated the list maximum from all fixed vertical regions. At 1024 × 768, the list now uses a 236 px internal viewport, the add-site action ends at 630 px, and the sidebar footer ends exactly at the 658 px workspace boundary.
- Post-fix evidence: `docs/options-implementation-1024.png` and browser layout metrics.

### Pass 4

- No actionable P0/P1/P2 differences remain after the final full-view and focused-detail comparisons.

### Pass 5

- [P1] Code review found that failed synchronization only rolled back React state, and a long-lived Options tab could overwrite newer popup changes.
- Fix: each mutation now starts from freshly loaded production state, writes through an updater, listens for `chrome.storage.onChanged`, and persists the previous state during rollback. Dialogs remain open until a mutation succeeds.
- [P2] Code review found nested interactive semantics in site rows and forced horizontal overflow below 760 px.
- Fix: split site selection and the site switch into sibling controls, removed the root minimum width, added a compact 390 px rule layout, disabled every mutation path while saving, and removed raw sensitive values from hover titles.
- Post-fix evidence: browser DOM snapshot, successful rule add/delete recheck, `docs/options-implementation-390.png`, `docs/options-implementation-final.png`, and zero console warnings/errors.

### Pass 6

- [P1] Final code review found that client-side read-modify-write could still race across the popup and Options page, and that rollback could overwrite a newer external write.
- Fix: moved production state commits into one background-owned task queue, added monotonically increasing state revisions with compare-and-swap conflict detection, and kept storage write, DNR synchronization, and rollback inside the same serialized background task. Popup and Options clients now consume the returned revision or the latest conflict state.
- [P2] Escape and the return action could still close the editor/page during an in-flight save.
- Fix: both are now guarded by the shared mutation lock; the return control is visibly disabled while saving.
- Post-fix evidence: 15 passing tests including background delegation and revision-conflict coverage, successful post-change browser add/delete verification, a passing production build, and zero console warnings/errors.

## Follow-up Polish

- [P3] The Phosphor globe has slightly different internal stroke proportions from the image-generated concept glyph. It remains visually consistent with the popup and the rest of the production icon family.

## Implementation Checklist

- [x] Recreate the selected master-detail information architecture.
- [x] Connect the page to the extension's real per-host state and synchronization path.
- [x] Make search, filters, selection, toggles, add/edit/delete, menus, and confirmations functional.
- [x] Add the manifest Options page entry and popup navigation.
- [x] Verify fonts, spacing, colors, assets, copy, icons, responsiveness, and accessibility.
- [x] Pass browser verification, tests, build, and design comparison.

final result: passed
