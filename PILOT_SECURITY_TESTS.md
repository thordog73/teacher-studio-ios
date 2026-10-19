# Build 11: live two-device test plan — fictional accounts only

**NOT COMPLETED.** These tests require an isolated actual Supabase project and separate devices/sessions. The attached ZIP cannot establish their outcomes.

1. Sign in as fictional Teacher T (distinct Auth UID); create Class C with Student A and Student B.
2. Generate email-bound, 7-day, 128-bit-random invitation for Guardian A to Student A. The teacher must send it themselves; copy/share isn't proof of delivery.
3. Guardian A signs in by one-time email code on a different device, using the exact invited email, then claims the secret invitation code. Invalid, expired, replayed, wrong-email, and malformed codes must fail.
4. Invite Guardian B to Student B with a different account and code. Verify Guardian B never reads Student A's records via raw REST GET, not only by interface.
5. Create classwide Assignment 1 and a student-specific Assignment 2 for A. Guardian A should see both; B should see only Assignment 1. Attempt direct storage download of an unauthorized attachment.
6. Record grades privately for A and B. Guardian A/B must see zero draft grade rows. Release A, then verify A can see only A; B still sees none. Disable class-wide `share_grades` and verify even released records disappear.
7. Edit and revoke A's released grade. Confirm the new value remains unpublished until separately approved; reenable grade-sharing before explicit release.
8. Send whole-class announcement; both authorized guardians can read. Send private message to Guardian A; Guardian B and unrelated accounts must be denied via REST. Guardian reply must fail when `allow_parent_replies=false`.
9. Run `revoke_guardian_access` on A's guardian link. Raw REST for A must immediately deny new reads of the child's data and files. Note that content already downloaded onto A's device cannot be remotely erased.
10. Create invitation for Guardian A and cancel it via `cancel_family_invitation`. Claim attempt fails; another classroom's teacher must be unable to cancel or revoke the first teacher's links.
11. Confirm no public roles may read `invitations`, `guardian_links`, `results`, `messages`, or the private Storage bucket. Never embed a database service secret in app code.
12. Test throttling on OTP and invite codes, audit events, recovery, school authorization, user deletion, retention, custody restrictions, accessibility, and incident response before school use.

Current demo-mode role switches demonstrate *views only*. They do not count as separate-account security tests.
