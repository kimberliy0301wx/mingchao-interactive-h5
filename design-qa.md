**Source Visual Truth**

- `/var/folders/c5/tl78l_5s0j30qj0kkcvsb5l00000gn/T/codex-clipboard-a0ee8434-b282-4377-9111-dc8630a22751.png`
- `/var/folders/c5/tl78l_5s0j30qj0kkcvsb5l00000gn/T/codex-clipboard-d2ea2871-9bf7-41e3-9c97-629c807e2937.png`
- `/var/folders/c5/tl78l_5s0j30qj0kkcvsb5l00000gn/T/codex-clipboard-6d080267-8bf7-4e70-9f14-efc24478a294.png`

**Implementation Evidence**

- `qa/story-latest-comparison.png`: reference and current ACT 1 entry state.
- `qa/symbols-latest-comparison.png`: reference and current ACT 2 three-symbol state.
- `qa/social-latest-comparison.png`: reference and current ACT 3 station state.
- `qa/kick-midflight-latest-desktop.png`: football visibly inside the goal during the kick animation.
- `qa/story-selected-text-safe-mobile.png`: current 403 x 624 expanded story state after moving card content into the inner safe area.
- `qa/heart-centered-mobile.png`: current 403 x 624 expanded story state with the heartbeat icon/copy group centered in its plaque.
- `qa/photo-ghost-nowrap-mobile.png`: 403 x 624 camera step with the pixel-group fallback label kept on one line.
- `qa/home-restored-mobile.png`: restored mobile intro landing page.
- `qa/heart-frame-aligned-mobile.png`: 403 x 624 expanded story state with the green heartbeat plaque aligned to the quote and continuation plaques.
- `qa/shoe-title-nowrap-mobile.png`: 403 x 624 ACT 1 state with `旧球鞋里的海风` kept on one line.
- `qa/kick-miss-retry-mobile.png`: 403 x 624 missed-shot state with the reset ball and `再踢一遍` action.
- `qa/kick-retry-goal-mobile.png`: 403 x 624 retry state with the football visibly inside the goal.

**Full-View Comparison**

- The original intro is the landing view again; its primary CTA enters ACT 1. The two ACT 1 choice plaques share equal grid tracks, and all card text stays inside its frame.
- ACT 2 keeps the flag centered, places selected symbols directly beneath it, and moves the five-item material tray upward by reducing the compact flag stage height.
- ACT 3 moves station content into the plaque safe area; headings and status copy remain inside both frames.
- The final kick judges the pointer against the gold zone, freezes timing during the 980 ms flight, sends mistimed shots wide, restores the ball for retry, and only opens the result after a correctly timed goal.

**Focused Region Comparison**

- ACT 1 card widths measured equally at 555 px in the in-app browser; every title and subtitle bounding box was inside its card.
- ACT 2 selected-symbol order was verified below the centered flag; flag center differed from viewport center by less than 3 px.
- ACT 3 both heading/status pairs passed an 8 px inset boundary check after the upward content adjustment.
- Mid-flight football bounds were fully inside the goal bounds before the result screen appeared.

**Comparison History**

- P1 ACT 1: unequal vertical cards and loose copy. Fixed with equal two-column tracks, compact stacked card content on phones, and explicit wrapping constraints.
- P1 ACT 1 selected state: the two-line emotion title pushed its subtitle onto the lower frame art. Fixed by lifting the complete card content 6 px and tightening title line height; the expanded-state subtitle now has a 20 px measured bottom inset.
- P2 heartbeat CTA: the icon/copy pair was visually left-weighted. Fixed with a centered flex group; measured group center and button center now differ by less than 0.001 px.
- P2 photo fallback CTA: `不用镜头，使用像素合影` wrapped on compact screens. Fixed with a 10 px mobile label, 24 px icon, tighter spacing, and explicit no-wrap behavior; measured scroll width equals client width at 403 px.
- P2 heartbeat frame: opaque right-side padding inside the source plaque art made its visible edge stop early. Fixed by scaling the mobile background to 114% from the left edge so its visible right border aligns with the surrounding frames.
- P2 emotion-card title: `旧球鞋里的海风` wrapped on compact screens. Fixed with a scoped 11 px mobile title and explicit no-wrap behavior; its single measured text rect remains inside the card.
- P1 ACT 2: material tray sat too low. Fixed with a 232 px compact mobile flag stage and an 11 px visual gap before the tray.
- P1 ACT 3: station status copy touched the lower art edge. Fixed with smaller mobile typography and a 5 px upward content shift.
- P1 final kick: button skipped directly to the result. Fixed with a visible ball-to-net animation before result navigation.
- P1 kick timing: every click previously scored regardless of pointer position. Fixed with live pointer-zone bounds, synchronized goal/miss animations, a recoverable missed state, and the `再踢一遍` retry action.

**Interactions Tested**

- Opened the H5 and verified the original intro is the landing view and ACT 1 is not rendered before the start action.
- Clicked the emotion story card and verified the same-view memory content appears.
- Selected three city symbols and verified centered flag composition and material order.
- Checked both station cards for text containment.
- Clicked outside the gold timing zone, verified the right-side miss animation, confirmed no result navigation, and saw `再踢一遍` after 980 ms.
- Retried inside the gold zone, verified the football was inside the goal during the synchronized animation, and confirmed the result view appeared after 980 ms.
- Missed the timing zone at 349 x 624 and verified the pixel-style dialog appears only after the 980 ms miss animation; its copy and retry control stay inside the frame, and retry closes the dialog while restarting the timing pointer.
- Verified the result-page share action uses the requested fixed two-line label, with `发布` on line one and `分享给朋友` on line two; the slash was removed and both lines remain inside the button.
- At 330 x 624, the result card now keeps its exact 4:5 ratio and renders the 1200 x 1500 generated image with `object-fit: contain`; all card content remains visible instead of being horizontally cropped.
- Verified the shared pixel feedback dialog across intro/sensor, story, city symbols, social cheering, remix, and kick states. Blocked prerequisite actions remain clickable, explain the exact missing step, and dismiss without leaving the current stage.
- Verified representative global-dialog states at compact mobile sizes: story selection, incomplete memory hold, too-light and too-crowded symbols, missing social stations, incomplete remix, and a missed kick. At 330 x 624, the dialog title, copy, and action all remain inside the frame.
- Collected all three memory fragments, pressed and released the heartbeat before the 1.2-second threshold, and verified the shared dialog explains that a sustained hold is required. The completion timer clears on early release so the fire cannot light accidentally.
- Added `sfx-cheer.mp3` to the valid clap path. After both social pads were active, one `拍手助威` click started the cheer clip while the existing clap animation and standard button clip remained active; blocked claps still show guidance without playing the cheer.
- Added `sfx-shutter.mp3` to successful real-camera capture after video readiness; the not-ready warning does not trigger it.
- Extended the shutter clip to the explicit pixel-avatar photo action, centralized the cheer clip inside valid clap registration so both the button and phone-sensor clap paths use it, and verified entering the final result restarts the cheer clip once.
- Replaced the looping background track with `bgm-0714.mp3`; the unique filename prevents the previous BGM from being reused from browser cache while preserving first-interaction start and the existing volume.
- Verified all six active MP3 assets load successfully; the first interaction starts the looping BGM, standard buttons use the button clip, valid applause adds the cheer clip, real-camera capture adds the shutter clip, entering the correct city-symbol range uses the city clip, and shooting uses the kick clip without the generic button clip overlapping it.
- At 330 x 624, verified the top-right global sound switch stays inside the viewport: switching it off pauses the BGM and every active sound effect, while switching it on resumes the BGM. The phone-sensor control remains available inside the social and kick stages.
- Checked in-app browser console errors after returning to ACT 1: none.

**Mobile Visual Viewport Fix (2026-07-15)**

- Source screenshots: `/var/folders/c5/tl78l_5s0j30qj0kkcvsb5l00000gn/T/codex-clipboard-70127870-168e-478c-8e4e-abd941399889.png` (intro) and `/var/folders/c5/tl78l_5s0j30qj0kkcvsb5l00000gn/T/codex-clipboard-a7a1d651-8bb5-4d01-a97f-7899bb07655e.png` (social photo).
- Compared both source screenshots side by side with current 339 x 623 browser renders. The intro title, CTA, speech bubble, guide character, and four ritual tokens fill the single-screen stage without the previous blank vertical gaps.
- The ACT 3 comparison keeps the complete photo frame, consent controls, and continuation plaque visible in one screen.
- Rechecked at 402 x 686, matching the reported iPhone/WeChat visible content area. `--app-height` measured 686 px, while the shell measured exactly 402 x 686; the stage-fit content height matched its 590 px viewport in both intro and ACT 3 states.
- Exercised the real interaction path from intro through ACT 3: selected the emotional story, restored all three memories, completed the 1.2-second hold, selected two city symbols, activated both social pads, and completed three applause interactions.
- Browser console errors after the responsive verification: none.

**Findings**

- No remaining P0, P1, or P2 issues in the requested surfaces.

**Follow-up Polish**

- None required for this change set.

final result: passed
