# Build 12 — Family Desk

Build 12 extends the existing Teacher Studio source with a Today home and a teacher action queue. Its purpose is to put a routine answer next to the action a parent or teacher needs to take. The design review used simulated perspectives; it does not represent interviews, a survey or observed results from real parents and teachers.

## Two starting points

**A family starts with one child and one date.** The home brings together the confirmed dismissal plan, outstanding requests and six quick topics. A question such as “Can someone else pick up my child today?” leads from an answer into a dated request instead of requiring the parent to guess whom to message.

**A teacher starts with work requiring attention.** The queue distinguishes an action owned by the teacher, an item waiting for somebody else and resolved work. An unread informational notice does not automatically create an obligation. Existing Family Connect setup and the full teacher tool collection remain accessible.

## Dismissal: a confirmed plan and a requested change

The usual schedule establishes a default. A date-specific approved exception changes the plan for that date. A pending request is shown separately and does not replace the confirmed plan.

Example: the usual plan is the bus. A parent requests a pickup for Tuesday. While review is pending, the display still identifies the bus as the confirmed plan and the pickup as the requested change. An approved practice review makes pickup the confirmed plan for Tuesday. The exception must not become the new plan for Wednesday or for the following Tuesday.

If a second request is made after approval, keep the last confirmed plan visible until the replacement is reviewed. A declined request must not erase an earlier approved plan. Where no plan has been recorded, say so rather than inventing one.

Pickup information separates the intended adult from verification. A password/code can support a school's process; it is not, by itself, authority to release a child or add someone to an authorized list. This build demonstrates those distinctions locally and does not verify a real adult or approve a real dismissal.

Early pickup uses one attendance request with a time and collecting adult. While it is pending, the regular plan remains visible. After the teacher records the adult check and confirms it in practice, the selected date shows pickup at that time. The list does not copy the private attendance explanation into the visible transport plan.

## Calls: who should call whom?

A call request identifies the direction and next actor. A parent asking the teacher to call is different from a teacher asking the parent to call. The phone indicator includes text so it remains understandable without color.

Logging an attempt, no answer or voicemail records useful history but does not resolve the request. Reaching the person can still leave a follow-up action. Resolution is an explicit decision. “New,” “call requested” and “past the requested date” describe different things and should not be treated as synonyms.

Family callback preferences are saved for the selected child and the individual guardian account. The teacher's call card shows that linked guardian's phone, suitable times and language/format when provided. A private callback derived from a message remains addressed to that one guardian.

## Announcements and individual communication

A message states its audience. One student's family, a class and an entire school are different recipient groups. A family reply belongs in its private conversation rather than becoming visible to other families.

A notice also distinguishes information from an action. Reading is separate from acknowledgement, and acknowledging a notice is separate from completing another task linked from it. A response indicator in this practice screen is not proof that another device received or read a message.

The existing configured Family Connect messaging path remains available. Its underlying Supabase account and access model has not been replaced by the new local queue. The new operational requests do not have a remote delivery, synchronization or approval service in this version.

A parent's explicit private reply to a reply-required message moves that original support task back to the teacher for follow-up. A written reply to a call request does not resolve the call. Form responses remain separate for each child and guardian; the teacher sees different guardian decisions and can follow up rather than having one response silently overwrite another.

## FAQs that complete a task

Starter answers are editable fictional examples. A teacher can adapt wording and route an action to the relevant area, such as attendance, dismissal or a private message. Opening an action must retain the selected child and must not submit a request automatically.

Examples to exercise:

- “Is school open tomorrow?” — view the relevant calendar/date information.
- “My child will be absent.” — open an attendance report.
- “Can Grandma collect my child?” — open a dated dismissal request.
- “It says received. Is the change approved?” — explain the difference and show the current confirmed plan.
- “Why is the phone red?” — explain who is asked to call whom.
- “What work needs attention?” — open the child's teacher-released work and grade information.

School-specific times, contacts and procedures should be entered as such. A starter example is not an authoritative statement of a real school's policy.

The thirty generic starter answers are shared school examples and are seeded once. Deleting one through School Hub persists across renders and reloads. A teacher can save a classroom-specific answer; that answer is filtered to its classroom in both the Family Desk and School Hub. "Save as FAQ draft" opens an editor for review before any answer is published.

## Scope and retained records

Each private operational item belongs to a student. Switching students must update the visible summary, forms and detail panels together. One family's private replies, contact information, pickup details and acknowledgement history do not belong in another family's view. Offline role switching remains a fictional demonstration, not a substitute for server authorization.

The existing grade-release gate remains in place: an unreleased result stays out of family views, and turning grade sharing off still hides the applicable released grades. Existing settings and teacher materials are preserved.

The encrypted `.tsbackup` flow continues to cover teacher-owned materials under its existing rules. Student profiles, grades, private communication, pickup details/codes, callbacks and other new family-practice records are not added to those backups. The native Files/Share bridge remains unchanged; it prepares and shares the encrypted file without claiming automatic cloud delivery.

## Opening and rebuilding

`npm run build:standalone` reads `web/index.html`, inlines its CSS and classic scripts in source order, embeds the icon, omits the web manifest and sets `TEACHER_STANDALONE_DEMO=true`. The standalone app skips service-worker registration and connected startup. It uses `web/native-bridge.js`, whose browser stub reports native sharing unavailable; the installed iPhone build instead receives the existing bundled Capacitor bridge.

The standalone HTML has no CDN or hosted runtime assets. Explicit external resource links still require a connection when a person chooses to open them. The multi-file source can be served through localhost/HTTPS, and `npm run build` prepares `www/` for Capacitor.

App version 1.2.0 comes from `package.json`; the bundle identifier remains `com.frontofus.teacherstudio`. The existing Codemagic compile and TestFlight workflows are retained. This update does not itself produce a signed Apple binary or upload a build.

## Practical source review

The communication tests exercise date-specific requests, confirmation boundaries, callback history, student scope, FAQ rendering/action routing and practice labels. The inherited tests continue to cover the math engine, encrypted material backups, native bridge behavior and family grade visibility. `npm run test:package` checks new asset wiring and retained native packaging.

A local test run does not demonstrate remote message delivery, real-school pickup verification, live cross-account database behavior or physical iPhone sharing. Those are separate behaviors from this build's local Family Desk practice.
