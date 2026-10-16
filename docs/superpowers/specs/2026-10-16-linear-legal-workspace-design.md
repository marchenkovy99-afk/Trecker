# Linear-inspired legal tracker redesign (16 October 2026)

## Purpose
Turn the existing dark legal tracker into a compact, fast, high-density workspace inspired by the supplied Linear-style reference. Preserve all existing data, Supabase sync, cases, drafts, attachments, and mobile behavior. No remote database migrations.

## Architecture
Keep the original application's data structures and sync keys. Add an external, same-origin `linear-workspace.js` and `linear-workspace.css` enhancement loaded after the existing app. That module enhances navigation, provides an issue-list renderer, grouped filters, built-in task presets, case next step editing, history, and safe session-scoped undo. Adjust `app-core.js` task form to persist four optional new fields in existing task JSON records without changing old records or replacing cloud endpoints.

## UX from the reference
Desktop: fixed narrow charcoal sidebar, sharply defined item rows, subdued monochrome surfaces, small green state indicators, collapsed group headings, top title and filter/action toolbar. Avoid imitation of third-party branding. Mobile: full-width list, top-level tabs retained, tap targets at least 40px, 16px form controls to avoid iOS focus auto-zoom, no horizontal overflow.

## Behavior
1. Tasks retain existing `dueDate` as hard deadline and add `actionDate` (work-on date). Old tasks default to no action date.
2. Waiting state includes optional `waitingFor` text and `waitingReminderAt` date; highlights reminders that have arrived, but does not claim OS push notifications.
3. Each task adds `nextStep`; cases add optional `nextStep` field, edited in context and saved through the existing projects array.
4. Presets: contract review, legal opinion, regulatory reply, follow-up. Choosing a preset fills the existing task editor without saving until confirmed.
5. Recent change history and Undo for applicable saves within the current browser tab. Undo must compare current values against its recorded post-operation snapshots before reversal and should never silently overwrite later changes. Draft typing excluded; deletion of attachments cannot be undone and must not be represented as recoverable.

## Preservation and test criteria
- No new Supabase tables or configuration changes, same `LS.tasks`, `LS.projectTasks`, `LS.projects` keys and existing Supabase implementation.
- Existing browser functional tests and sync regression tests pass; additional e2e tests validate task dates, waiting, templates and mobile dimensions.
- CSP remains strict: external resources are loaded from self, no inline-script changes or unsafe-inline.
- GitHub Pages production `main` remains untouched until branch regression is reviewed.
- Existing cloud endpoint test may still fail with ENOTFOUND; report separately and do not claim production sync verified.
