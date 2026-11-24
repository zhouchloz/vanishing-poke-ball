# The Vanishing Poke Ball

Experiment website for Psych 30 Illusion Project 2 (Hetong (Chloe) Zhou).

The website presents three throw animations (real throw, vanish with upward gaze, vanish with hand gaze) in a randomized order of ten trials, playing each throw once frame by frame with the cursor hidden. After each throw, it records where the participant clicks as the ball's last visible position and whether they judged that it reached its apex, converts the click into the animation's original pixel coordinates, and stores the responses locally in the browser.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | The participant page (instructions, warm-up, ten trials, short questions, debrief) |
| `css/style.css` | Page styling |
| `js/core.js` | Trial randomization, click-to-coordinate conversion, displacement scoring |
| `js/public_session.js` | Starts a fresh session automatically when someone opens the link |
| `js/player.js` | Plays each animation once from its 40 PNG frames (50 ms per frame) |
| `js/participant.js` | Runs the screens, the response questions, and saves each trial |
| `js/storage.js` | Saves responses in the browser's localStorage only |
| `js/stim_public.js`, `js/still_data.js` | Frame locations and the neutral response image |
| `js/debrief_questions.js`, `js/debrief_text.js` | End-of-study questions and debrief |
| `stimuli/frames/s1`–`s3` | The 40 frames of each animation |
| `stimuli/gifs/` | The three animations as GIFs, for reference |

No data leave the browser. Nothing is sent to a server.

## Run locally

Open a terminal in this folder and run `python3 -m http.server 8000`, then visit `http://localhost:8000`.
